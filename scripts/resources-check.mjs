// Isolated Electron runtime: synthetic providers and temporary storage only.
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
const root = await mkdtemp(join(tmpdir(), "gom-resources-"));
const output = join(project, "outputs/resources-check"),
  bootstrap = join(root, "bootstrap.cjs");
let client, page;
const checks = [],
  errors = [];
const html =
  '<!doctype html><html><body><h1>Resource fixture</h1><input id="contact-search-input"><div class="chatlist"><a data-peer-id="fixture"></a></div><button aria-label="New message">New message</button><textarea id="draft"></textarea><script>window.fixtureToken=crypto.randomUUID()</script></body></html>';
await writeFile(
  bootstrap,
  `
const e=require('electron');
e.app.setPath('appData',${JSON.stringify(root)});
require('node:os').homedir=()=>${JSON.stringify(root)};
process.env.LOCALAPPDATA=${JSON.stringify(root)};
globalThis.resourceFixture={sessions:new Map(),metricsCalls:0,alerts:[],audible:false,failWrite:false,failFlush:false};
resourceFixture.makeDownload=()=>new (require('node:events').EventEmitter)();
const metrics=e.app.getAppMetrics.bind(e.app);
e.app.getAppMetrics=()=>{resourceFixture.metricsCalls++;return metrics();};
const fs=require('node:fs/promises'),write=fs.writeFile.bind(fs);
fs.writeFile=async(path,...args)=>{
 if(require('node:path').basename(String(path))==='resource-sleep.json.tmp'){
  if(resourceFixture.failWrite)throw Error('fixture disk failure');
  const p=resourceFixture.pauseWrite;
  if(p?.armed){p.armed=false;p.entered=true;await new Promise(resolve=>p.release=resolve);}
 }
 return write(path,...args);
};
e.dialog.showMessageBox=async()=>resourceFixture.confirm===false?{response:0}:{response:1};
e.Notification.isSupported=()=>true;
e.Notification.prototype.show=function(){resourceFixture.alerts.push(this.title);this.emit('show');};
e.Notification.prototype.close=function(){this.emit('close');};
e.safeStorage.isAsyncEncryptionAvailable=async()=>true;
e.safeStorage.encryptStringAsync=async text=>Buffer.from(text);
e.safeStorage.decryptStringAsync=async bytes=>({result:bytes.toString(),shouldReEncrypt:false});
e.shell.openExternal=async()=>{throw Error('Unexpected external navigation');};
const from=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{
 const s=from(...args);
 if(!resourceFixture.sessions.has(s)){
  resourceFixture.sessions.set(s,args[0]);
  s.protocol.handle('https',()=>new Response(${JSON.stringify(html)},{headers:{'content-type':'text/html; charset=utf-8'}}));
  const flush=s.cookies.flushStore.bind(s.cookies);
  s.cookies.flushStore=async()=>{if(resourceFixture.failFlush)throw Error('fixture flush');return flush();};
 }
 return s;
};
require(${JSON.stringify(entry)});
`,
);
const state = () => page.evaluate(() => window.desktop.state());
async function eventually(label, predicate, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.desktop);
  await eventually("Telegram loaded", async () => !!(await view("telegram")));
}
async function quit() {
  const exited = new Promise((r) => client.process().once("exit", r));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
  client = undefined;
}
async function resource(action, data = {}) {
  const s = await state();
  return page.evaluate(
    ({ action, data }) => window.desktop.resources(action, data),
    { action, data: { lockVersion: s.privateSpace.lockVersion, ...data } },
  );
}
async function view(id) {
  return client.evaluate(async ({ webContents }, id) => {
    const w = webContents
      .getAllWebContents()
      .find(
        (w) =>
          resourceFixture.sessions.get(w.session) ===
            (id.startsWith("acc_") ? "persist:tn-account-" : "persist:") + id &&
          w.getURL().startsWith("https:"),
      );
    if (!w || w.isLoadingMainFrame()) return null;
    return {
      id: w.id,
      ...(await w.executeJavaScript(
        '({token:window.fixtureToken,draft:document.querySelector("#draft")?.value,local:localStorage.getItem("resource-fixture")})',
      )),
    };
  }, id);
}
async function openResources() {
  await page.evaluate(() => window.desktop.settings());
  await page.locator('[data-tab="resources"]').click();
  await resource("surface", { open: true });
}
try {
  await launch();
  await run("resource bridge exists", async () =>
    assert.equal(
      await page.evaluate(() => typeof window.desktop.resources),
      "function",
    ),
  );
  await run(
    "measurement starts only for visible resources and first CPU is unknown",
    async () => {
      assert.equal(
        await client.evaluate(() => resourceFixture.metricsCalls),
        0,
      );
      await openResources();
      await eventually(
        "first resource sample",
        async () => !!(await state()).resources.snapshot,
      );
      const s = (await state()).resources.snapshot;
      assert.equal(s.total.cpuPercent, null);
      assert.ok(s.total.memoryMiB > 0);
      assert.equal(JSON.stringify(s).includes('"pid"'), false);
      await eventually(
        "second CPU interval",
        async () =>
          (await state()).resources.snapshot?.total.cpuPercent != null,
      );
    },
  );
  await run(
    "sleep removes only chosen page, wake preserves session storage and other drafts",
    async () => {
      const other = await view("telegram");
      await client.evaluate(async ({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find(
            (w) => resourceFixture.sessions.get(w.session) === "persist:zalo",
          );
        await w.executeJavaScript(
          'localStorage.setItem("resource-fixture","kept");document.cookie="resource_cookie=kept;path=/;SameSite=Lax"',
        );
        const other = webContents
          .getAllWebContents()
          .find(
            (w) =>
              resourceFixture.sessions.get(w.session) === "persist:telegram",
          );
        await other.executeJavaScript(
          'document.querySelector("#draft").value="bản nháp khác"',
        );
      });
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, true);
      assert.equal(await view("zalo"), null);
      assert.ok((await state()).resources.sleeping.includes("zalo"));
      assert.equal((await view("telegram")).id, other.id);
      assert.equal((await view("telegram")).draft, "bản nháp khác");
      await new Promise((r) => setTimeout(r, 4300));
      assert.equal(await view("zalo"), null);
      assert.equal((await resource("wake", { accountId: "zalo" })).ok, true);
      await eventually("woken page", async () => !!(await view("zalo")));
      assert.equal((await view("zalo")).local, "kept");
      const cookies = await client.evaluate(async ({ session }) =>
        session
          .fromPartition("persist:zalo")
          .cookies.get({ name: "resource_cookie" }),
      );
      assert.equal(cookies[0].value, "kept");
    },
  );
  await run(
    "resource settings provide sortable rows and sleep/wake controls",
    async () => {
      assert.equal(await page.locator('[data-tab="resources"]').count(), 1);
      await page.locator('[data-tab="resources"]').click();
      await page.locator("#resource-sort").selectOption("name");
      assert.equal(
        await page.locator("#resource-rows [data-account]").count(),
        8,
      );
      await page.locator('[data-account="zalo"] button').click();
      await eventually("UI sleeps account", async () =>
        (await state()).resources.sleeping.includes("zalo"),
      );
      await page.locator('[data-account="zalo"] button').click();
      await eventually("UI wakes account", async () => !!(await view("zalo")));
    },
  );
  await run(
    "cancel and failed session flush leave the page running",
    async () => {
      const before = await view("zalo");
      await client.evaluate(() => {
        resourceFixture.confirm = false;
      });
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      await client.evaluate(() => {
        resourceFixture.confirm = true;
        resourceFixture.failFlush = true;
      });
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      assert.equal((await view("zalo")).id, before.id);
      assert.equal((await state()).resources.sleeping.includes("zalo"), false);
      await client.evaluate(() => {
        resourceFixture.failFlush = false;
      });
    },
  );
  await run(
    "selecting an account during persistence cancels pending sleep",
    async () => {
      const before = await view("zalo"),
        epoch = (await state()).privateSpace.lockVersion;
      await client.evaluate(() => {
        resourceFixture.pauseWrite = { armed: true };
      });
      await page.evaluate(
        (data) => {
          window.pendingResource = window.desktop.resources("sleep", data);
        },
        { accountId: "zalo", lockVersion: epoch },
      );
      await eventually("sleep write paused", () =>
        client.evaluate(() => resourceFixture.pauseWrite?.entered),
      );
      await page.evaluate(() => window.desktop.activate("zalo"));
      await client.evaluate(() => resourceFixture.pauseWrite.release());
      assert.equal(
        (await page.evaluate(() => window.pendingResource)).ok,
        false,
      );
      assert.equal((await view("zalo")).id, before.id);
      assert.equal((await state()).resources.sleeping.includes("zalo"), false);
      const stored = JSON.parse(
        await readFile(
          join(root, "TinNhanDesktop/resource-sleep.json"),
          "utf8",
        ),
      );
      assert.equal(stored.sleeping.includes("zalo"), false);
      await openResources();
    },
  );
  await run(
    "sleep persists through restart and explicit selection wakes it",
    async () => {
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, true);
      await quit();
      await launch();
      assert.equal(await view("zalo"), null);
      assert.ok((await state()).resources.sleeping.includes("zalo"));
      await new Promise((resolve) => setTimeout(resolve, 4300));
      assert.equal(await view("zalo"), null);
      await page.evaluate(() => window.desktop.activate("zalo"));
      await eventually(
        "explicit selection wakes page",
        async () => !!(await view("zalo")),
      );
      assert.equal((await state()).active, "zalo");
      assert.equal((await view("zalo")).local, "kept");
      await openResources();
    },
  );
  await run(
    "audible page, popup, download and floating chat block sleep",
    async () => {
      await client.evaluate(({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find(
            (w) => resourceFixture.sessions.get(w.session) === "persist:zalo",
          );
        resourceFixture.originalAudible = w.isCurrentlyAudible;
        w.isCurrentlyAudible = () => true;
      });
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      await client.evaluate(({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find(
            (w) => resourceFixture.sessions.get(w.session) === "persist:zalo",
          );
        w.isCurrentlyAudible = resourceFixture.originalAudible;
      });
      await client.evaluate(async ({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find(
            (w) => resourceFixture.sessions.get(w.session) === "persist:zalo",
          );
        await w.executeJavaScript(
          'void window.open("https://chat.zalo.me/resource-popup")',
        );
      });
      await eventually("popup ready", () =>
        client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some((w) =>
            w.webContents.getURL().includes("resource-popup"),
          ),
        ),
      );
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      await client.evaluate(({ BrowserWindow }) => {
        for (const w of BrowserWindow.getAllWindows())
          if (w.webContents.getURL().includes("resource-popup")) w.destroy();
      });
      await client.evaluate(({ session }) => {
        const item = resourceFixture.makeDownload();
        item.setSaveDialogOptions = () => {};
        resourceFixture.download = item;
        session
          .fromPartition("persist:zalo")
          .emit("will-download", { preventDefault: () => {} }, item);
      });
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      await client.evaluate(() => resourceFixture.download.emit("done"));
      await page.evaluate(() => window.desktop.activate("zalo"));
      assert.equal(
        (await page.evaluate(() => window.desktop.floatChat())).ok,
        true,
      );
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      await page.evaluate(() => window.desktop.activate("zalo"));
      await openResources();
    },
  );
  await run(
    "workspace switch during persistence cancels sleep and clears private metrics",
    async () => {
      const epoch = (await state()).privateSpace.lockVersion;
      await client.evaluate(() => {
        resourceFixture.pauseWrite = { armed: true };
      });
      await page.evaluate(
        (data) => {
          window.pendingResource = window.desktop.resources("sleep", data);
        },
        { accountId: "zalo", lockVersion: epoch },
      );
      await eventually("private switch write paused", () =>
        client.evaluate(() => resourceFixture.pauseWrite?.entered),
      );
      const setup = await page.evaluate(() =>
        window.desktop.privateSpace("setup", {
          password: "resource-fixture-password",
        }),
      );
      assert.equal(setup.ok, true);
      await client.evaluate(() => resourceFixture.pauseWrite.release());
      assert.equal(
        (await page.evaluate(() => window.pendingResource)).ok,
        false,
      );
      const added = await page.evaluate(() =>
        window.desktop.addAccount("zalo", "RESOURCE_PRIVATE_ACCOUNT", "P"),
      );
      assert.equal(added.ok, true);
      await page.evaluate((id) => window.desktop.activate(id), added.accountId);
      await eventually(
        "private page loaded",
        async () => !!(await view(added.accountId)),
      );
      await openResources();
      await eventually(
        "private resource sample",
        async () => !!(await state()).resources.snapshot,
      );
      assert.deepEqual(
        Object.keys((await state()).resources.snapshot.accounts),
        [added.accountId],
      );
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
      assert.equal(
        (await resource("sleep", { accountId: added.accountId })).ok,
        true,
      );
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      const normal = await state();
      assert.equal(
        JSON.stringify(normal.resources).includes(added.accountId),
        false,
      );
      assert.equal(
        await page.evaluate(() =>
          document.body.textContent.includes("RESOURCE_PRIVATE_ACCOUNT"),
        ),
        false,
      );
      assert.equal(
        (await resource("wake", { accountId: added.accountId })).ok,
        false,
      );
      await openResources();
    },
  );
  await run(
    "leaving or hiding resource settings stops measurement",
    async () => {
      await openResources();
      await eventually(
        "open sample",
        async () => !!(await state()).resources.snapshot,
      );
      await page.locator('[data-tab="appearance"]').click();
      await eventually(
        "sampler closed",
        async () => !(await state()).resources.open,
      );
      const count = await client.evaluate(() => resourceFixture.metricsCalls);
      await new Promise((resolve) => setTimeout(resolve, 4300));
      assert.equal(
        await client.evaluate(() => resourceFixture.metricsCalls),
        count,
      );
      await openResources();
      await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("index.html"))
          .hide(),
      );
      await eventually(
        "hidden sampler closed",
        async () => !(await state()).resources.snapshot,
      );
      const hidden = await client.evaluate(() => resourceFixture.metricsCalls);
      await new Promise((resolve) => setTimeout(resolve, 4300));
      assert.equal(
        await client.evaluate(() => resourceFixture.metricsCalls),
        hidden,
      );
      await client.evaluate(({ BrowserWindow, app }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("index.html"),
        );
        w.show();
        app.focus({ steal: true });
        w.focus();
      });
      await eventually("visible shell", () =>
        page.evaluate(() => document.visibilityState === "visible"),
      );
      await openResources();
    },
  );
  await run(
    "resource UI fits 940px and 1280px in light/dark themes",
    async () => {
      await mkdir(output, { recursive: true });
      assert.equal(
        (await resource("sleep", { accountId: "discord" })).ok,
        true,
      );
      await page.locator("#resource-sort").selectOption("name");
      await eventually(
        "visual CPU sample",
        async () =>
          (await state()).resources.snapshot?.total.cpuPercent != null,
      );
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
        await page.locator(".resource-overview").scrollIntoViewIfNeeded();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.screenshot({
          path: join(output, `resources-${width}-${theme}.png`),
          animations: "disabled",
        });
      }
    },
  );
  await run("write failure preserves running view and marker", async () => {
    const before = await view("zalo");
    await client.evaluate(() => {
      resourceFixture.failWrite = true;
    });
    assert.equal((await resource("sleep", { accountId: "zalo" })).ok, false);
    assert.equal((await view("zalo")).id, before.id);
    assert.equal((await state()).resources.sleeping.includes("zalo"), false);
    await client.evaluate(() => {
      resourceFixture.failWrite = false;
    });
  });
  await run(
    "reminder open reports failed wake instead of success",
    async () => {
      await quit();
      await launch();
      await openResources();
      assert.equal((await resource("sleep", { accountId: "zalo" })).ok, true);
      const lockVersion = (await state()).privateSpace.lockVersion;
      assert.equal(
        (
          await page.evaluate((data) => window.desktop.reminder("add", data), {
            accountId: "zalo",
            note: "resource wake failure",
            dueAt: Date.now() + 3600000,
            lockVersion,
          })
        ).ok,
        true,
      );
      const item = (await state()).reminders.items.find(
        (item) => item.note === "resource wake failure",
      );
      await client.evaluate(() => {
        resourceFixture.failWrite = true;
      });
      const result = await page.evaluate(
        (data) => window.desktop.reminder("open", data),
        { id: item.id, lockVersion },
      );
      assert.equal(result.ok, false);
      assert.equal(await view("zalo"), null);
      assert.equal((await state()).resources.sleeping.includes("zalo"), true);
      await client.evaluate(() => {
        resourceFixture.failWrite = false;
      });
    },
  );
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(checks.length + " resource checks passed");
} finally {
  if (client) await quit().catch(() => client?.close());
  await rm(root, { recursive: true, force: true });
}
