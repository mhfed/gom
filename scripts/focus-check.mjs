// Real Electron runtime, temporary appData and synthetic pages only.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import executablePath from "electron";
const entry = process.env.GOM_SMOKE_APP_ASAR
  ? join(process.env.GOM_SMOKE_APP_ASAR, "dist/main.cjs")
  : fileURLToPath(new URL("../dist/main.cjs", import.meta.url));

const project = fileURLToPath(new URL("..", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "gom-focus-"));
const output = join(project, "outputs/focus-check");
const bootstrap = join(root, "bootstrap.cjs");
const checks = [],
  errors = [];
let client, page;
const fixtureHTML = `<!doctype html><html><body><h1>Focus fixture</h1>
<input id="contact-search-input"><div class="chatlist"><a data-peer-id="fixture"></a></div>
<button aria-label="New message">New message</button><textarea id="draft"></textarea>
<script>window.documentToken=crypto.randomUUID()</script></body></html>`;
await writeFile(
  bootstrap,
  `
const e = require('electron');
e.app.setPath('appData', ${JSON.stringify(root)});
require('node:os').homedir = () => ${JSON.stringify(root)};
process.env.LOCALAPPDATA = ${JSON.stringify(root)};
globalThis.focusFixture = {sessions:new Map(), requests:{}, checks:{}, alerts:[], offset:0, prompts:[], holdPrompt:false};
const setContextMenu=e.Tray.prototype.setContextMenu;
e.Tray.prototype.setContextMenu=function(menu){focusFixture.trayMenu=menu;return setContextMenu.call(this,menu);};
const realNow=Date.now.bind(Date); Date.now=()=>realNow()+focusFixture.offset;
e.safeStorage.isEncryptionAvailable=()=>true;
e.safeStorage.isAsyncEncryptionAvailable=async()=>true;
e.safeStorage.encryptStringAsync=async text=>Buffer.from(text);
e.safeStorage.decryptStringAsync=async bytes=>({result:bytes.toString(),shouldReEncrypt:false});
e.Notification.isSupported=()=>true;
e.Notification.prototype.show=function(){focusFixture.alerts.push({title:this.title,body:this.body});this.emit('show');};
e.Notification.prototype.close=function(){this.emit('close');};
e.dialog.showMessageBox=async()=>{
  if(focusFixture.holdPrompt) return new Promise(resolve=>focusFixture.prompts.push(resolve));
  return {response:1};
};
e.shell.openExternal=async()=>{throw Error('Unexpected external navigation');};
e.clipboard.write=async()=>{throw Error('Unexpected clipboard write');};
const fromPartition=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{
  const ses=fromPartition(...args);
  if(!focusFixture.sessions.has(ses)) {
    focusFixture.sessions.set(ses,args[0]);
    const request=ses.setPermissionRequestHandler.bind(ses), check=ses.setPermissionCheckHandler.bind(ses);
    ses.setPermissionRequestHandler=handler=>{focusFixture.requests[args[0]]=handler;request(handler);};
    ses.setPermissionCheckHandler=handler=>{focusFixture.checks[args[0]]=handler;check(handler);};
    ses.protocol.handle('https',()=>new Response(${JSON.stringify(fixtureHTML)},{headers:{'content-type':'text/html; charset=utf-8'}}));
  }
  return ses;
};
require(${JSON.stringify(entry)});
`,
);
const state = () => page.evaluate(() => window.desktop.state());
const focus = (action, data) =>
  page.evaluate(({ action, data }) => window.desktop.focus(action, data), {
    action,
    data,
  });
async function eventually(label, predicate, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("Timed out: " + label);
}
async function run(label, work) {
  await work();
  checks.push(label);
  console.log("PASS " + label);
}
async function launch() {
  client = await _electron.launch({ executablePath, args: [bootstrap] });
  page = await client.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(() => !!window.desktop);
  await eventually("provider ready", () =>
    client.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .some(
          (w) =>
            w.getURL().startsWith("https://chat.zalo.me") && !w.isLoading(),
        ),
    ),
  );
}
async function quit() {
  const exited = new Promise((resolve) =>
    client.process().once("exit", resolve),
  );
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
  client = undefined;
}
async function contents() {
  return client.evaluate(({ webContents }) =>
    webContents
      .getAllWebContents()
      .filter((w) => /^https:/.test(w.getURL()))
      .map((w) => ({ id: w.id, url: w.getURL(), muted: w.isAudioMuted() })),
  );
}
async function permission() {
  return client.evaluate(({ webContents }) => {
    const w = webContents
      .getAllWebContents()
      .find((w) => w.getURL().startsWith("https://chat.zalo.me"));
    return focusFixture.checks["persist:zalo"](
      w,
      "notifications",
      "https://chat.zalo.me",
      { isMainFrame: true, requestingUrl: "https://chat.zalo.me" },
    );
  });
}
async function mainNow() {
  return client.evaluate(() => Date.now());
}
async function start(duration = 60000, muteAudio = false) {
  const endsAt = (await mainNow()) + duration;
  assert.equal((await focus("start", { endsAt, muteAudio })).ok, true);
  return endsAt;
}
try {
  await launch();
  await run("focus bridge exists", async () =>
    assert.equal(
      await page.evaluate(() => typeof window.desktop.focus),
      "function",
    ),
  );
  await run(
    "start blocks permissions without changing account choices or manual pause",
    async () => {
      await page.evaluate(() =>
        window.desktop.setNotification("zalo", "allow"),
      );
      assert.equal(await permission(), true);
      const before = (await state()).preferences;
      await start();
      assert.equal(await permission(), false);
      assert.deepEqual(
        (await state()).preferences.notifications,
        before.notifications,
      );
      assert.equal((await state()).preferences.paused, false);
    },
  );
  await run("invalid IPC preserves the active session", async () => {
    const before = (await state()).preferences.focus;
    for (const data of [
      null,
      {},
      { endsAt: 0, muteAudio: false },
      { endsAt: (await mainNow()) + 86460000, muteAudio: false },
      { endsAt: (await mainNow()) + 1000, muteAudio: "yes" },
    ])
      assert.equal((await focus("start", data)).ok, false);
    assert.deepEqual((await state()).preferences.focus, before);
    assert.equal((await focus("unknown")).ok, false);
  });
  await run(
    "audio mute survives account switches and retains documents and drafts",
    async () => {
      const before = await contents();
      await client.evaluate(async ({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith("https://chat.zalo.me"));
        await w.executeJavaScript(
          'document.querySelector("#draft").value="bản nháp fixture"',
        );
      });
      await start(60000, true);
      assert.ok((await contents()).every((w) => w.muted));
      await page.evaluate(() => window.desktop.activate("telegram"));
      assert.ok((await contents()).every((w) => w.muted));
      await focus("stop");
      assert.ok((await contents()).every((w) => !w.muted));
      assert.deepEqual(
        (await contents()).map((w) => w.id),
        before.map((w) => w.id),
      );
      assert.equal(
        await client.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .find((w) => w.getURL().startsWith("https://chat.zalo.me"))
            .executeJavaScript('document.querySelector("#draft").value'),
        ),
        "bản nháp fixture",
      );
    },
  );
  await run(
    "expiry while hidden restores sound but keeps manual pause",
    async () => {
      await page.evaluate(() => window.desktop.setPreference("paused", true));
      await start(500, true);
      await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].hide(),
      );
      await eventually(
        "focus expired",
        async () => !(await state()).preferences.focus,
      );
      assert.equal((await state()).preferences.paused, true);
      assert.equal(await permission(), false);
      assert.ok((await contents()).every((w) => !w.muted));
      await page.evaluate(() => window.desktop.setPreference("paused", false));
      assert.equal(await permission(), true);
      await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].show(),
      );
    },
  );
  await run("wake expires an overdue session immediately", async () => {
    await start(60000, true);
    await client.evaluate(({ powerMonitor }) => {
      focusFixture.offset = 120000;
      powerMonitor.emit("resume");
    });
    assert.equal((await state()).preferences.focus, undefined);
    assert.ok((await contents()).every((w) => !w.muted));
    await client.evaluate(() => {
      focusFixture.offset = 0;
    });
  });
  await run(
    "restart resumes focus and discards expired persisted state",
    async () => {
      const endsAt = await start(60000, true);
      await quit();
      await launch();
      assert.equal((await state()).preferences.focus.endsAt, endsAt);
      assert.ok((await contents()).every((w) => w.muted));
      await quit();
      const path = join(root, "TinNhanDesktop/window.json");
      const stored = JSON.parse(await readFile(path, "utf8"));
      stored.preferences.focus.endsAt = Date.now() - 1;
      await writeFile(path, JSON.stringify(stored));
      await launch();
      assert.equal((await state()).preferences.focus, undefined);
      assert.ok((await contents()).every((w) => !w.muted));
    },
  );
  await run(
    "permission prompt opened before focus cannot grant during focus",
    async () => {
      await page.evaluate(() => window.desktop.setNotification("zalo", "ask"));
      await client.evaluate(({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith("https://chat.zalo.me"));
        focusFixture.holdPrompt = true;
        focusFixture.requests["persist:zalo"](
          w,
          "notifications",
          (result) => {
            focusFixture.permissionResult = result;
          },
          { isMainFrame: true, requestingUrl: "https://chat.zalo.me" },
        );
      });
      await eventually("pending permission prompt", () =>
        client.evaluate(() => focusFixture.prompts.length > 0),
      );
      await start();
      await client.evaluate(() => {
        focusFixture.holdPrompt = false;
        focusFixture.prompts.shift()({ response: 1 });
      });
      await eventually("permission refused", () =>
        client.evaluate(() => focusFixture.permissionResult === false),
      );
      assert.equal(await permission(), false);
      await focus("stop");
    },
  );
  await run("new popup stays muted until focus stops", async () => {
    await start(60000, true);
    const count = (await contents()).length;
    await client.evaluate(async ({ webContents }) => {
      const w = webContents
        .getAllWebContents()
        .find((w) => w.getURL().startsWith("https://chat.zalo.me"));
      await w.executeJavaScript(
        'void window.open("https://chat.zalo.me/focus-popup")',
      );
    });
    await eventually(
      "popup opened",
      async () => (await contents()).length === count + 1,
    );
    assert.ok((await contents()).every((w) => w.muted));
    await focus("stop");
    assert.ok((await contents()).every((w) => !w.muted));
    await client.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows())
        if (w.webContents.getURL().includes("focus-popup")) w.destroy();
    });
  });
  await run(
    "reminders remain pending during focus and deliver once after stop",
    async () => {
      await start(300000);
      const snapshot = await state();
      const result = await page.evaluate(
        (data) => window.desktop.reminder("add", data),
        {
          accountId: "zalo",
          note: "focus fixture due",
          dueAt: (await mainNow()) + 60000,
          lockVersion: snapshot.privateSpace.lockVersion,
        },
      );
      assert.equal(result.ok, true);
      await client.evaluate(({ powerMonitor }) => {
        focusFixture.offset = 120000;
        powerMonitor.emit("resume");
      });
      await eventually(
        "reminder overdue",
        async () => (await state()).reminders.dueCount === 1,
      );
      assert.equal((await state()).reminders.items[0].notifiedAt, null);
      assert.equal(await client.evaluate(() => focusFixture.alerts.length), 0);
      await focus("stop");
      await eventually("reminder delivered", () =>
        client.evaluate(() => focusFixture.alerts.length === 1),
      );
      await client.evaluate(() => {
        focusFixture.offset = 0;
      });
    },
  );
  await run(
    "floating chat respects focus and ending focus preserves inactive workspace mute",
    async () => {
      await page.evaluate(() => window.desktop.activate("zalo"));
      await start(60000, true);
      assert.equal(
        (await page.evaluate(() => window.desktop.floatChat())).ok,
        true,
      );
      await eventually(
        "floating chat detached",
        async () => (await state()).floating.detached,
      );
      assert.ok((await contents()).every((w) => w.muted));
      await focus("stop");
      assert.ok((await contents()).every((w) => !w.muted));
      await start(60000, true);
      assert.equal(
        (
          await page.evaluate(() =>
            window.desktop.privateSpace("setup", {
              password: "focus-fixture-password",
            }),
          )
        ).ok,
        true,
      );
      await focus("stop");
      assert.ok((await contents()).every((w) => w.muted));
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      assert.ok((await contents()).every((w) => !w.muted));
    },
  );
  await run(
    "tray reschedules without silently unmuting an active focus session",
    async () => {
      await start(60000, true);
      await client.evaluate(() => {
        const item = focusFixture.trayMenu.items.find((item) =>
          item.submenu?.items.some(
            (child) => child.label === "Kết thúc Tập trung",
          ),
        );
        item.submenu.items.find((item) => item.label === "30 phút").click();
      });
      assert.equal((await state()).preferences.focus.muteAudio, true);
      await client.evaluate(() => {
        const item = focusFixture.trayMenu.items.find((item) =>
          item.submenu?.items.some(
            (child) => child.label === "Kết thúc Tập trung",
          ),
        );
        item.submenu.items
          .find((item) => item.label === "Kết thúc Tập trung")
          .click();
      });
      assert.equal((await state()).preferences.focus, undefined);
    },
  );
  await run(
    "settings support preset start, audio option, reschedule and early stop",
    async () => {
      await page.evaluate(() => window.desktop.settings());
      await page.locator('[data-tab="notifications"]').click();
      assert.equal(await page.locator("#focus-form").count(), 1);
      await page.locator("#focus-mute-audio").check();
      await page.locator("#focus-duration").selectOption("30");
      await page.locator("#focus-start").click();
      await eventually(
        "UI starts focus",
        async () => !!(await state()).preferences.focus,
      );
      const first = (await state()).preferences.focus;
      assert.equal(first.muteAudio, true);
      assert.ok(
        first.endsAt - Date.now() > 29 * 60000 &&
          first.endsAt - Date.now() <= 30 * 60000,
      );
      assert.equal(await page.locator("#focus-open").isVisible(), true);
      await page.locator("#focus-duration").selectOption("60");
      await page.locator("#focus-start").click();
      await eventually(
        "UI reschedules",
        async () => (await state()).preferences.focus.endsAt > first.endsAt,
      );
      await page.locator("#focus-stop").click();
      await eventually(
        "UI ends focus",
        async () => !(await state()).preferences.focus,
      );
    },
  );
  await run(
    "custom deadline draft survives state updates and invalid time is rejected",
    async () => {
      const local = (time) => {
        const d = new Date(time);
        return new Date(time - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      };
      await page.locator("#focus-duration").selectOption("custom");
      const value = local(Date.now() + 90 * 60000);
      await page.locator("#focus-until").fill(value);
      await page.evaluate(() => window.desktop.setPreference("paused", true));
      assert.equal(await page.locator("#focus-until").inputValue(), value);
      await page.locator("#focus-start").click();
      await eventually(
        "custom focus started",
        async () => !!(await state()).preferences.focus,
      );
      assert.equal(
        (await state()).preferences.focus.endsAt,
        new Date(value).getTime(),
      );
      const active = (await state()).preferences.focus;
      await page.locator("#focus-until").fill(local(Date.now() - 60000));
      await page.locator("#focus-start").click();
      assert.deepEqual((await state()).preferences.focus, active);
      await page.locator("#focus-stop").click();
      assert.equal((await state()).preferences.paused, true);
      await page.evaluate(() => window.desktop.setPreference("paused", false));
    },
  );
  await run(
    "custom form kept open overnight accepts a fresh future deadline",
    async () => {
      const shift = 26 * 3600000;
      await page.locator("#focus-duration").selectOption("custom");
      await client.evaluate((_e, shift) => {
        focusFixture.offset = shift;
      }, shift);
      await page.evaluate((shift) => {
        window.focusOriginalNow = Date.now;
        Date.now = () => window.focusOriginalNow() + shift;
      }, shift);
      const deadline = Date.now() + shift + 60 * 60000;
      const date = new Date(deadline);
      const value = new Date(deadline - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      await page.locator("#focus-until").fill(value);
      await page.locator("#focus-start").click();
      await eventually(
        "overnight custom deadline accepted",
        async () => !!(await state()).preferences.focus,
        2000,
      );
      assert.equal(
        (await state()).preferences.focus.endsAt,
        new Date(value).getTime(),
      );
      await focus("stop");
      await page.evaluate(() => {
        Date.now = window.focusOriginalNow;
      });
      await client.evaluate(() => {
        focusFixture.offset = 0;
      });
    },
  );
  await run(
    "toolbar opens focus settings and places keyboard focus in the form",
    async () => {
      await start();
      await page.evaluate(() => window.desktop.activate("zalo"));
      await page.locator("#focus-open").click();
      await eventually("focus settings visible", () =>
        page.locator("#focus-form").isVisible(),
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "focus-duration",
      );
      await focus("stop");
    },
  );
  await run("command palette starts and stops focus", async () => {
    await page.evaluate(() => window.desktop.command(true));
    await page.locator("#command-search").fill("Tập trung 30 phút");
    await page.locator("#command-search").press("Enter");
    await eventually(
      "command starts focus",
      async () => !!(await state()).preferences.focus,
    );
    await page.evaluate(() => window.desktop.command(true));
    await page.locator("#command-search").fill("Kết thúc Tập trung");
    await page.locator("#command-search").press("Enter");
    await eventually(
      "command stops focus",
      async () => !(await state()).preferences.focus,
    );
  });
  await run(
    "focus settings fit supported widths in light and dark themes",
    async () => {
      await mkdir(output, { recursive: true });
      await page.evaluate(() => window.desktop.settings());
      await page.locator('[data-tab="notifications"]').click();
      await page.locator("#focus-duration").selectOption("30");
      await page.locator("#focus-mute-audio").check();
      await page.locator("#focus-start").click();
      for (const [width, height, theme] of [
        [940, 640, "light"],
        [1280, 800, "dark"],
      ]) {
        await client.evaluate(
          ({ BrowserWindow }, size) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes("index.html"))
              .setContentSize(...size),
          [width, height],
        );
        await page.evaluate((theme) => window.desktop.setTheme(theme), theme);
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          theme,
        );
        await page.locator("#focus-form").scrollIntoViewIfNeeded();
        const bounds = await page.locator("#focus-form").boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.screenshot({
          path: join(output, `focus-${width}-${theme}.png`),
        });
      }
      await focus("stop");
    },
  );
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} Focus checks passed`);
} finally {
  if (client) await quit().catch(() => client?.close());
  await rm(root, { recursive: true, force: true });
}
