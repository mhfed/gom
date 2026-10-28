// Isolated Electron smoke: temporary appData/home, mock Keychain, and synthetic
// HTTP(S) in every session. Never connects to or reads personal accounts.
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import electronExecutable from "electron";

const project = fileURLToPath(new URL("..", import.meta.url));
const appArchive = process.env.GOM_SMOKE_APP_ASAR;
const entry = appArchive ? join(appArchive, "dist/main.cjs") : join(project, "dist/main.cjs");
await access(appArchive || entry);
const root = await mkdtemp(join(tmpdir(), "gom-private-space-"));
const bootstrap = join(root, "bootstrap.cjs");
const password = "fixture-private-password";
const privateName = "PRIVATE_FIXTURE_ACCOUNT";
const checks = [];
const errors = [];
let client;
let page;
const fixture = `<!doctype html><html data-private-fixture="true"><body>
<h1>Private-space fixture, no real accounts</h1><input id="contact-search-input">
<div class="chatlist"><a data-peer-id="fixture"></a></div>
<button aria-label="New message">New message</button><textarea id="draft"></textarea>
<script>document.documentElement.dataset.documentToken=crypto.randomUUID()</script>
</body></html>`;

await writeFile(
  bootstrap,
  `
const e = require('electron');
const root = ${JSON.stringify(root)};
e.app.setPath('appData', root);
process.env.LOCALAPPDATA = root;
require('node:os').homedir = () => root;
globalThis.privateFixture = {sessions: new Map(), tray: [], notifications: [], menus: []};
e.shell.openExternal = async () => { throw Error('Fixture attempted external navigation'); };
e.dialog.showMessageBox = async () => ({response: 1});
e.Notification.isSupported = () => true;
e.Notification.prototype.show = function() { privateFixture.notifications.push(this.title); this.emit('show'); };
e.Notification.prototype.close = function() { this.emit('close'); };
const trayMenu = e.Tray.prototype.setContextMenu;
e.Tray.prototype.setContextMenu = function(menu) { privateFixture.tray = menu.items.map(i => i.label); return trayMenu.call(this, menu); };
e.Menu.prototype.popup = function(options) { privateFixture.menus.push(this.items.map(i=>i.label)); options?.callback?.(); };
const original = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = original(...args);
  if (!privateFixture.sessions.has(ses)) {
    privateFixture.sessions.set(ses, args[0]);
    const respond = () => new Response(${JSON.stringify(fixture)}, {headers: {'content-type':'text/html; charset=utf-8'}});
    ses.protocol.handle('https', respond);
    ses.protocol.handle('http', respond);
  }
  return ses;
};
require(${JSON.stringify(entry)});
`,
);

async function eventually(label, predicate, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error(`Timed out: ${label}`);
}
const state = () => page.evaluate(() => window.desktop.state());
const command = (action, data) =>
  page.evaluate(
    ({ action, data }) => window.desktop.privateSpace(action, data),
    { action, data },
  );
async function unlock() {
  const current = await state();
  const delay = (current.privateSpace?.retryAt || 0) - Date.now();
  if (delay > 0)
    await new Promise((resolve) => setTimeout(resolve, delay + 30));
  assert.equal((await command("unlock", { password })).ok, true);
}
async function launch() {
  client = await _electron.launch({
    executablePath: electronExecutable,
    args: ["--use-mock-keychain", bootstrap],
    timeout: 20000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(() => !!window.desktop?.privateSpace);
  await eventually("initial state", async () => !!(await state()).privateSpace);
  assert.deepEqual(
    await client.evaluate(({ app }) => ({
      data: app.getPath("userData"),
      session: app.getPath("sessionData"),
      mock: app.commandLine.hasSwitch("use-mock-keychain"),
    })),
    {
      data: join(root, "TinNhanDesktop"),
      session: join(root, "TinNhanDesktop"),
      mock: true,
    },
  );
  assert.deepEqual((await state()).profiles, []);
}
async function stop() {
  if (!client) return;
  await client.close();
  client = undefined;
}
async function views() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith("file:"),
    );
    return Promise.all(
      win.contentView.children.map(async (view) => ({
        id: view.webContents.id,
        partition: globalThis.privateFixture.sessions.get(
          view.webContents.session,
        ),
        visible: view.getVisible(),
        muted: view.webContents.isAudioMuted(),
        document: await view.webContents
          .executeJavaScript(
            `({
        fixture:document.documentElement.dataset.privateFixture,
        token:document.documentElement.dataset.documentToken,
        draft:document.querySelector('#draft')?.value,
        permission:Notification.permission
      })`,
          )
          .catch(() => null),
      })),
    );
  });
}
async function run(label, work) {
  await work();
  checks.push(label);
  console.log(`PASS ${label}`);
}

try {
  await launch();
  await run(
    "ordinary hide/show keeps current chat before private setup",
    async () => {
      await page.evaluate(() => window.desktop.activate("telegram"));
      await client.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().startsWith("file:"),
        );
        w.hide();
        w.show();
      });
      assert.equal((await state()).panel, "service");
      assert.equal((await state()).active, "telegram");
    },
  );
  await run("setup dialog creates password and clears inputs", async () => {
    await page.locator("#private-space-toggle").click();
    await page.locator("#private-space-dialog").waitFor({ state: "visible" });
    await page.locator("#private-password").fill(password);
    await page.locator("#private-password-confirm").fill(password);
    await page.locator("#private-space-submit").click();
    await eventually(
      "setup unlocked",
      async () => (await state()).privateSpace.unlocked,
    );
    await page.locator("#private-space-dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#private-password").inputValue(), "");
  });

  let before;
  await run("private account keeps its native page and draft", async () => {
    assert.equal(
      (
        await page.evaluate(
          (name) => window.desktop.editAccount("zalo", name, "PF"),
          privateName,
        )
      ).ok,
      true,
    );
    await page.evaluate(() => window.desktop.activate("zalo"));
    await eventually("fixture Zalo page", async () =>
      (await views()).some(
        (v) => v.partition === "persist:zalo" && v.document?.token,
      ),
    );
    await client.evaluate(async ({ webContents }) => {
      const contents = webContents
        .getAllWebContents()
        .find((c) => c.getURL() === "https://chat.zalo.me/");
      await contents.executeJavaScript(
        "document.querySelector('#draft').value = 'private fixture draft'",
      );
    });
    before = (await views()).find((v) => v.partition === "persist:zalo");
    assert.equal(
      (await command("membership", { accountId: "zalo", private: true })).ok,
      true,
    );
    assert.equal(
      (await state()).accounts.find((a) => a.id === "zalo").private,
      true,
    );
    assert.equal(
      (await views()).find((v) => v.partition === "persist:zalo").document
        .permission,
      "denied",
    );
  });

  await run(
    "locked snapshot, DOM, menus, notification and IPC do not expose private account",
    async () => {
      await page.evaluate(() => window.desktop.settings());
      await eventually("private label rendered", async () =>
        (await page.locator("body").textContent()).includes(privateName),
      );
      await command("lock");
      await eventually(
        "private label scrubbed",
        async () =>
          !(await page.locator("body").textContent()).includes(privateName),
      );
      assert.equal(JSON.stringify(await state()).includes(privateName), false);
      assert.equal(
        (await state()).accounts.some((a) => a.id === "zalo"),
        false,
      );
      const hidden = (await views()).find(
        (v) => v.partition === "persist:zalo",
      );
      assert.equal(hidden.visible, false);
      assert.equal(hidden.muted, true);
      await page.evaluate(async () => {
        await window.desktop.activate("zalo");
        await window.desktop.activateProvider("zalo");
        await window.desktop.testNotification("zalo");
      });
      assert.equal((await state()).active === "zalo", false);
      assert.equal(
        (await views()).find((v) => v.partition === "persist:zalo").visible,
        false,
      );
      assert.equal(
        (
          await page.evaluate(() =>
            window.desktop.editAccount("zalo", "BYPASS", "B"),
          )
        )?.ok,
        false,
      );
      assert.equal(
        (await command("membership", { accountId: "zalo", private: false })).ok,
        false,
      );
      assert.equal(
        await client.evaluate(
          (_, name) =>
            globalThis.privateFixture.tray.some((label) =>
              label.includes(name),
            ),
          privateName,
        ),
        false,
      );
      assert.equal(
        await client.evaluate(
          () => globalThis.privateFixture.notifications.length,
        ),
        0,
      );
      assert.equal(
        (await command("unlock", { password: "incorrect-password" })).ok,
        false,
      );
      assert.equal((await state()).privateSpace.unlocked, false);
      await unlock();
      await page.evaluate(() => window.desktop.activate("zalo"));
      const after = (await views()).find((v) => v.partition === "persist:zalo");
      assert.equal(after.id, before.id);
      assert.equal(after.document.token, before.document.token);
      assert.equal(after.document.draft, before.document.draft);
    },
  );

  await run("private popup is hidden and muted on lock", async () => {
    await client.evaluate(async ({ webContents }) => {
      const contents = webContents
        .getAllWebContents()
        .find((c) => c.getURL() === "https://chat.zalo.me/");
      await contents.executeJavaScript(
        "window.open('https://chat.zalo.me/private-fixture-popup'); true",
        true,
      );
    });
    await eventually("owned private popup", async () =>
      client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((w) =>
          w.webContents.getURL().includes("private-fixture-popup"),
        ),
      ),
    );
    await command("lock");
    assert.deepEqual(
      await client.evaluate(({ BrowserWindow }) => {
        const popup = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("private-fixture-popup"),
        );
        return popup
          ? {
              visible: popup.isVisible(),
              muted: popup.webContents.isAudioMuted(),
            }
          : { visible: false, muted: true };
      }),
      { visible: false, muted: true },
    );
  });

  await run(
    "new lock wins over an in-flight password verification",
    async () => {
      const result = await page.evaluate(async (password) => {
        const pending = window.desktop.privateSpace("unlock", { password });
        await window.desktop.privateSpace("lock");
        return pending;
      }, password);
      assert.equal(result.ok, false);
      assert.equal((await state()).privateSpace.unlocked, false);
    },
  );

  await run(
    "hide, minimize and OS lock all lock the private space",
    async () => {
      for (const trigger of ["hide", "minimize", "lock-screen"]) {
        await unlock();
        await client.evaluate(({ BrowserWindow, powerMonitor }, trigger) => {
          const win = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().startsWith("file:"),
          );
          if (trigger === "lock-screen") powerMonitor.emit("lock-screen");
          else win[trigger]();
        }, trigger);
        await eventually(
          `${trigger} locks`,
          async () => !(await state()).privateSpace.unlocked,
        );
        await client.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().startsWith("file:"),
          );
          win.restore();
          win.show();
        });
      }
    },
  );

  await run("all-private catalog has a safe empty public state", async () => {
    await unlock();
    const accounts = (await state()).accounts;
    for (const account of accounts)
      assert.equal(
        (await command("membership", { accountId: account.id, private: true }))
          .ok,
        true,
      );
    await command("lock");
    assert.deepEqual((await state()).accounts, []);
    assert.equal((await state()).active, "");
    await page.evaluate(() => window.desktop.settings());
    assert.equal((await state()).panel, "settings");
    await page.evaluate(() => window.desktop.providerLibrary(true));
    assert.equal((await state()).panel, "providers");
    await page.evaluate(async () => {
      await window.desktop.providerLibrary(false);
      await window.desktop.back();
      await window.desktop.reload();
      await window.desktop.settings();
      await window.desktop.welcome();
    });
    assert.equal((await state()).privateSpace.unlocked, false);
  });

  await run("restart begins locked without loading private pages", async () => {
    await stop();
    await launch();
    assert.equal((await state()).privateSpace.unlocked, false);
    assert.deepEqual((await state()).accounts, []);
    assert.deepEqual(await views(), []);
    await unlock();
    assert.ok((await state()).accounts.some((a) => a.name === privateName));
  });
  await run(
    "interrupted outbound membership recovers private on restart",
    async () => {
      await stop();
      const path = join(root, "TinNhanDesktop", "accounts.json");
      const catalog = JSON.parse(await readFile(path, "utf8"));
      catalog.accounts.find((a) => a.id === "zalo").private = false;
      await writeFile(path, JSON.stringify(catalog));
      await writeFile(
        join(root, "TinNhanDesktop", "private-membership.json"),
        JSON.stringify({ accountId: "zalo" }),
      );
      await launch();
      assert.equal(
        (await state()).accounts.some((a) => a.id === "zalo"),
        false,
      );
      assert.deepEqual(await views(), []);
      await unlock();
      assert.equal(
        (await state()).accounts.find((a) => a.id === "zalo").private,
        true,
      );
      assert.equal(
        JSON.parse(await readFile(path, "utf8")).accounts.find(
          (a) => a.id === "zalo",
        ).private,
        true,
      );
    },
  );
  assert.deepEqual(
    errors,
    [],
    "renderer must not throw during privacy transitions",
  );
  console.log(
    `PASS ${checks.length} private-space smoke checks, synthetic sessions only`,
  );
} finally {
  await stop();
  await rm(root, { recursive: true, force: true });
}
