import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = await mkdtemp(join(tmpdir(), "tin-nhan-03-"));
const bootstrap = join(root, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `
const e=require('electron');
e.app.setPath('appData',${JSON.stringify(root)});
require('node:os').homedir=()=>${JSON.stringify(root)};
globalThis.fixture={online:true,requests:{},checks:{},prompts:0,notifications:[],shortcutFailure:false,registered:new Set()};
e.net.isOnline=()=>fixture.online;
e.dialog.showMessageBox=async()=>{fixture.prompts++;return {response:1};};
e.globalShortcut.register=(key,cb)=>{if(fixture.shortcutFailure)return false;fixture.registered.add(key);fixture.shortcutCallback=cb;return true;};
e.globalShortcut.isRegistered=key=>fixture.registered.has(key);
e.globalShortcut.unregister=key=>fixture.registered.delete(key);
e.globalShortcut.unregisterAll=()=>fixture.registered.clear();
e.Notification.isSupported=()=>true;
e.Notification.prototype.show=function(){fixture.notifications.push(this);this.emit('show');};
e.Notification.prototype.close=function(){this.emit('close');};
e.app.whenReady().then(()=>{
for(const [id,color] of [['zalo','#ffffff'],['messenger','#18191a'],['telegram','#17212b']]) {
const ses=e.session.fromPartition('persist:'+id);
const req=ses.setPermissionRequestHandler.bind(ses),check=ses.setPermissionCheckHandler.bind(ses);
ses.setPermissionRequestHandler=handler=>{fixture.requests[id]=handler;req(handler);};
ses.setPermissionCheckHandler=handler=>{fixture.checks[id]=handler;check(handler);};
ses.protocol.handle('https',()=>new Response('<html><body style="background:'+color+'"><h1>Chats</h1><button aria-label="New message">New message</button><input id="contact-search-input"><div class="chatlist"><a data-peer-id="1"></a></div><textarea id="draft"></textarea></body></html>',{headers:{'content-type':'text/html'}}));
}
});
require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});
`,
);
let client, page;
async function waitState(predicate, label = "state condition") {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => window.desktop.state());
    if (predicate(snapshot)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out: " + label);
}
async function launch() {
  client = await _electron.launch({
    executablePath:
      "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    args: [bootstrap],
  });
  page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  await waitState(
    (s) => Object.values(s.statuses).every((v) => v === "authenticated"),
    "fixture authenticated",
  );
}
async function remote(id, code) {
  return client.evaluate(
    async ({ webContents }, { id, code }) => {
      const hosts = {
        zalo: "chat.zalo.me",
        messenger: "www.facebook.com",
        telegram: "web.telegram.org",
      };
      const w = webContents.getAllWebContents().find((w) => {
        try {
          return new URL(w.getURL()).hostname === hosts[id];
        } catch {
          return false;
        }
      });
      if (!w)
        throw Error(
          "missing remote " +
            id +
            " " +
            JSON.stringify(
              webContents.getAllWebContents().map((w) => w.getURL()),
            ),
        );
      return w.executeJavaScript(code);
    },
    { id, code },
  );
}
async function quit() {
  const exited = new Promise((r) => client.process().once("exit", r));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
}
try {
  await launch();
  const ids = await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children.map(
      (v) => v.webContents.id,
    ),
  );
  await remote(
    "messenger",
    'document.querySelector("#draft").value="unsent fixture"',
  );
  // A blocked subframe or popup must not fail/reload the healthy principal view.
  await page.evaluate(() => window.desktop.activate("messenger"));
  const blocked = await client.evaluate(({ webContents, BrowserWindow }) => {
    const principal = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("www.facebook.com"));
    let prevented = 0;
    const event = {
      preventDefault() {
        prevented++;
      },
    };
    principal.emit(
      "will-redirect",
      event,
      "https://outside.example/",
      false,
      false,
    );
    const popup = new BrowserWindow({
      show: false,
      webPreferences: {
        session: principal.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    principal.emit("did-create-window", popup, {});
    popup.webContents.emit(
      "will-redirect",
      event,
      "https://outside.example/",
      false,
      true,
    );
    popup.destroy();
    return prevented;
  });
  assert.equal(blocked, 2);
  assert.equal(
    await page.evaluate(
      async () => (await window.desktop.state()).connections.messenger.reason,
    ),
    null,
    "blocked popup/subframe must leave principal healthy",
  );
  assert.equal(
    await remote("messenger", 'document.querySelector("#draft").value'),
    "unsent fixture",
  );
  await page.evaluate(() =>
    window.desktop.setNotification("telegram", "allow"),
  );
  assert.equal(await remote("telegram", "Notification.permission"), "granted");
  assert.equal(
    await remote("telegram", "Notification.requestPermission()"),
    "granted",
  );
  const policies = await client.evaluate(async ({ webContents }) => {
    const w = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("web.telegram.org"));
    const check = globalThis.fixture.checks.telegram;
    const req = globalThis.fixture.requests.telegram;
    return {
      allowed: check(w, "notifications", "https://web.telegram.org", {
        isMainFrame: true,
        requestingUrl: "https://web.telegram.org/k/",
      }),
      subframe: check(w, "notifications", "https://evil.example", {
        isMainFrame: false,
        requestingUrl: "https://evil.example/",
      }),
      worker: check(null, "notifications", "https://web.telegram.org", {
        isMainFrame: false,
      }),
      external: await new Promise((r) =>
        req(w, "notifications", r, {
          isMainFrame: true,
          requestingUrl: "https://evil.example/",
        }),
      ),
    };
  });
  assert.deepEqual(policies, {
    allowed: true,
    subframe: false,
    worker: false,
    external: false,
  });
  await page.evaluate(() => window.desktop.setPreference("paused", true));
  assert.equal(await remote("telegram", "Notification.permission"), "denied");
  assert.equal(
    await client.evaluate(({ webContents }) => {
      const w = webContents
        .getAllWebContents()
        .find((w) => w.getURL().includes("web.telegram.org"));
      return globalThis.fixture.checks.telegram(
        w,
        "notifications",
        "https://web.telegram.org",
        { isMainFrame: true },
      );
    }),
    false,
  );
  await page.evaluate(() => window.desktop.setPreference("paused", false));
  await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await remote("telegram", "window.__tinNhanNotificationClicked()");
  await waitState((s) => s.active === "telegram", "notification activation");
  assert.equal(
    await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    true,
  );
  assert.deepEqual(
    await remote("telegram", "[typeof window.desktop,typeof require]"),
    ["undefined", "undefined"],
  );
  await page.evaluate(() => window.desktop.testNotification("telegram"));
  assert.equal(
    await client.evaluate(() => globalThis.fixture.notifications.length),
    1,
  );
  await page.evaluate(() => window.desktop.activate("zalo"));
  await client.evaluate(() =>
    globalThis.fixture.notifications[0].emit("click"),
  );
  await waitState((s) => s.active === "telegram", "notification activation");
  await page.evaluate(() => window.desktop.setPreference("shortcut", true));
  assert.equal(
    await page.evaluate(
      async () => (await window.desktop.state()).preferences.shortcut,
    ),
    true,
  );
  await client.evaluate(() => {
    globalThis.fixture.shortcutCallback();
  });
  assert.equal(
    await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  await client.evaluate(() => {
    globalThis.fixture.shortcutCallback();
  });
  assert.equal(
    await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    true,
  );
  await page.evaluate(() => window.desktop.setPreference("shortcut", false));
  await client.evaluate(() => {
    globalThis.fixture.shortcutFailure = true;
  });
  await page.evaluate(() => window.desktop.setPreference("shortcut", true));
  assert.equal(
    await page.evaluate(
      async () => (await window.desktop.state()).preferences.shortcut,
    ),
    false,
  );
  assert.match(
    await page.evaluate(async () => (await window.desktop.state()).notice),
    /app khác/,
  );
  await client.evaluate(() => {
    globalThis.fixture.online = false;
  });
  await waitState(
    (s) => s.connections.messenger.phase === "offline",
    "offline",
  );
  await client.evaluate(({ powerMonitor }) => {
    powerMonitor.emit("suspend");
    powerMonitor.emit("resume");
    globalThis.fixture.online = true;
  });
  await waitState(
    (s) => s.connections.messenger.phase === "connected",
    "wake online",
  );
  assert.equal(
    await remote("messenger", 'document.querySelector("#draft").value'),
    "unsent fixture",
  );
  // A late finish event for a failed navigation must not erase its error.
  await client.evaluate(({ webContents }) => {
    const w = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("chat.zalo.me"));
    globalThis.fixture.online = false;
    w.emit("did-fail-load", {}, -106, "offline", w.getURL(), true);
    w.emit("did-finish-load");
  });
  assert.equal(
    await page.evaluate(
      async () => (await window.desktop.state()).connections.zalo.reason,
    ),
    "network",
  );
  await client.evaluate(() => {
    globalThis.fixture.online = true;
  });
  await waitState(
    (s) =>
      s.statuses.zalo === "authenticated" && s.connections.zalo.reason === null,
    "provider recovered",
  );
  assert.equal(
    await remote("messenger", 'document.querySelector("#draft").value'),
    "unsent fixture",
  );
  await client.evaluate(({ webContents }) =>
    webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("chat.zalo.me"))
      .forcefullyCrashRenderer(),
  );
  await waitState(
    (s) => s.connections.zalo.reason === "crashed",
    "renderer crash detected",
  );
  await waitState(
    (s) =>
      s.statuses.zalo === "authenticated" && s.connections.zalo.reason === null,
    "provider recovered",
  );
  assert.equal(
    await remote("messenger", 'document.querySelector("#draft").value'),
    "unsent fixture",
  );
  const after = await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children.map(
      (v) => v.webContents.id,
    ),
  );
  assert.deepEqual(after, ids);
  await page.evaluate(() =>
    window.desktop.setNotification("messenger", "mute"),
  );
  await page.evaluate(() => window.desktop.setPreference("paused", true));
  await page.evaluate(() => window.desktop.settings());
  await mkdir("../desktop-check", { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "../desktop-check/settings-dark.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    document.querySelector("#settings-panel").scrollTop = 9999;
  });
  await page.screenshot({
    path: "../desktop-check/settings-notifications.png",
  });
  await quit();
  const stored = JSON.parse(
    await readFile(join(root, "TinNhanDesktop", "window.json"), "utf8"),
  );
  assert.equal(stored.preferences.notifications.messenger, "mute");
  assert.equal(stored.preferences.paused, true);
  await launch();
  assert.equal(
    await page.evaluate(
      async () => (await window.desktop.state()).preferences.paused,
    ),
    true,
  );
  assert.equal(
    await page.evaluate(
      async () =>
        (await window.desktop.state()).preferences.notifications.messenger,
    ),
    "mute",
  );
  console.log(
    "PASS isolated0.3 permission/frame policy, native notification test/click routing, shortcut/conflict, hide/show, offline/wake preserving drafts, failed-provider recovery, view identity and preference persistence",
  );
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
