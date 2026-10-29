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
const entry = appArchive
  ? join(appArchive, "dist/main.cjs")
  : join(project, "dist/main.cjs");
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
const fixtureFs = require('node:fs/promises');
const fixtureWriteFile = fixtureFs.writeFile.bind(fixtureFs);
fixtureFs.writeFile = async (path, ...args) => {
  const pause = globalThis.privateFixture.catalogPause;
  if (pause?.armed && require('node:path').basename(String(path)) === 'accounts.json.tmp') {
    pause.armed = false;
    pause.entered = true;
    await new Promise((resolve) => { pause.release = resolve; });
  }
  return fixtureWriteFile(path, ...args);
};
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
async function unlock(data = {}) {
  const current = await state();
  const delay = (current.privateSpace?.retryAt || 0) - Date.now();
  if (delay > 0)
    await new Promise((resolve) => setTimeout(resolve, delay + 30));
  assert.equal((await command("unlock", { password, ...data })).ok, true);
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

async function inPartition(partition, expression) {
  return client.evaluate(
    async ({ webContents }, { partition, expression }) => {
      const contents = webContents
        .getAllWebContents()
        .find(
          (contents) =>
            globalThis.privateFixture.sessions.get(contents.session) ===
              partition && !contents.getURL().includes("fixture-popup"),
        );
      if (!contents) throw Error("Missing fixture partition: " + partition);
      return contents.executeJavaScript(expression, true);
    },
    { partition, expression },
  );
}
async function popupState(marker) {
  return client.evaluate(({ BrowserWindow }, marker) => {
    const popup = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes(marker),
    );
    return popup
      ? { visible: popup.isVisible(), muted: popup.webContents.isAudioMuted() }
      : null;
  }, marker);
}
async function addAccount(provider, name) {
  const result = await page.evaluate(
    ({ provider, name }) => window.desktop.addAccount(provider, name, "PF"),
    { provider, name },
  );
  assert.equal(result.ok, true, result.message);
  assert.ok(result.accountId?.startsWith("acc_"));
  await page.evaluate((id) => window.desktop.activate(id), result.accountId);
  const partition = "persist:tn-account-" + result.accountId;
  await eventually("fixture account page", async () =>
    (await views()).some(
      (view) => view.partition === partition && view.document?.token,
    ),
  );
  return { id: result.accountId, partition };
}
function accountPartition(account) {
  return account.id.startsWith("acc_")
    ? "persist:tn-account-" + account.id
    : "persist:" + account.id;
}
async function assertNormalAudioRestored() {
  const current = await state();
  assert.equal(current.privateSpace.unlocked, false);
  const partitions = new Set(current.accounts.map(accountPartition));
  for (const view of await views())
    if (partitions.has(view.partition))
      assert.equal(
        view.muted,
        false,
        `normal session ${view.partition} must regain audio`,
      );
}

try {
  await launch();
  let normalNavigation;
  let publicBefore;
  let privateAccount;
  let privateBefore;
  let privateTabs;

  await run(
    "ordinary hide/show keeps current chat before private setup",
    async () => {
      await page.evaluate(() => window.desktop.activate("zalo"));
      await eventually("public fixture page", async () =>
        (await views()).some(
          (view) => view.partition === "persist:zalo" && view.document?.token,
        ),
      );
      await inPartition(
        "persist:zalo",
        `document.querySelector('#draft').value = 'normal fixture draft'; localStorage.setItem('workspace', 'normal'); true`,
      );
      publicBefore = (await views()).find(
        (view) => view.partition === "persist:zalo",
      );
      await page.evaluate(() => window.desktop.activate("telegram"));
      await eventually("public Telegram fixture", async () =>
        (await views()).some(
          (view) =>
            view.partition === "persist:telegram" && view.document?.token,
        ),
      );
      await inPartition(
        "persist:telegram",
        `window.open('https://web.telegram.org/normal-fixture-popup'); true`,
      );
      await eventually(
        "public popup",
        async () => !!(await popupState("normal-fixture-popup")),
      );
      await client.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((win) =>
          win.webContents.getURL().startsWith("file:"),
        );
        win.hide();
        win.show();
      });
      const current = await state();
      assert.equal(current.panel, "service");
      assert.equal(current.active, "telegram");
      normalNavigation = {
        active: current.active,
        panel: current.panel,
        tabs: current.providerTabs,
      };
    },
  );

  await run(
    "password setup enters an empty private workspace and clears inputs",
    async () => {
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
      const current = await state();
      assert.deepEqual(
        current.accounts,
        [],
        "a newly opened private space must be empty",
      );
      assert.deepEqual(current.providerTabs, { open: [], pinned: [] });
      assert.equal(current.active, "");
      assert.notEqual(current.panel, "service");
      for (const view of await views()) {
        assert.equal(
          view.visible,
          false,
          "normal view remains hidden inside private space",
        );
        assert.equal(
          view.muted,
          true,
          "normal view remains muted inside private space",
        );
      }
      assert.deepEqual(await popupState("normal-fixture-popup"), {
        visible: false,
        muted: true,
      });
    },
  );

  await run(
    "new private account has its own session, draft and account IPC boundary",
    async () => {
      privateAccount = await addAccount("zalo", privateName);
      const current = await state();
      assert.deepEqual(
        current.accounts.map((account) => account.id),
        [privateAccount.id],
      );
      assert.equal(current.accounts[0].private, true);
      assert.notEqual(privateAccount.partition, "persist:zalo");
      assert.equal(
        await inPartition(
          privateAccount.partition,
          "localStorage.getItem('workspace')",
        ),
        null,
      );
      await inPartition(
        privateAccount.partition,
        `document.querySelector('#draft').value = 'private fixture draft'; localStorage.setItem('workspace', 'private'); true`,
      );
      privateBefore = (await views()).find(
        (view) => view.partition === privateAccount.partition,
      );
      assert.equal(privateBefore.document.permission, "denied");
      assert.equal(
        await inPartition("persist:zalo", "localStorage.getItem('workspace')"),
        "normal",
      );
      await page.evaluate(async () => {
        await window.desktop.activate("zalo");
        await window.desktop.pinAccount("zalo");
        await window.desktop.testNotification("zalo");
      });
      assert.equal((await state()).active, privateAccount.id);
      assert.equal(
        (
          await page.evaluate(() =>
            window.desktop.editAccount("zalo", "BYPASS", "B"),
          )
        )?.ok,
        false,
      );
      assert.equal(
        (await page.evaluate(() => window.desktop.archiveAccount("zalo")))?.ok,
        false,
      );
      assert.equal((await state()).presentation.pinned.includes("zalo"), false);
      assert.equal(
        (await views()).find((view) => view.partition === "persist:zalo")
          .visible,
        false,
      );
    },
  );

  await run(
    "provider tab pins and closing stay within their workspace",
    async () => {
      await page.evaluate(() => window.desktop.pinProvider("zalo"));
      const privateTelegram = await addAccount("telegram", "Private Telegram");
      assert.equal(
        (await state()).accounts.find(
          (account) => account.id === privateTelegram.id,
        ).private,
        true,
      );
      assert.equal(
        (await page.evaluate(() => window.desktop.closeProvider("telegram")))
          .ok,
        true,
      );
      const current = await state();
      assert.deepEqual(current.providerTabs, {
        open: ["zalo"],
        pinned: ["zalo"],
      });
      privateTabs = current.providerTabs;
      assert.equal(current.active, privateAccount.id);
      await command("lock");
      const normal = await state();
      assert.equal(normal.active, normalNavigation.active);
      assert.equal(normal.panel, normalNavigation.panel);
      assert.deepEqual(normal.providerTabs, normalNavigation.tabs);
      assert.ok(normal.accounts.every((account) => !account.private));
      await assertNormalAudioRestored();
      const publicAfter = (await views()).find(
        (view) => view.partition === "persist:zalo",
      );
      assert.equal(publicAfter.id, publicBefore.id);
      assert.equal(publicAfter.document.token, publicBefore.document.token);
      assert.equal(publicAfter.document.draft, publicBefore.document.draft);
      await unlock();
      assert.equal((await state()).active, privateAccount.id);
      assert.deepEqual((await state()).providerTabs, privateTabs);
      const after = (await views()).find(
        (view) => view.partition === privateAccount.partition,
      );
      assert.equal(after.id, privateBefore.id);
      assert.equal(after.document.token, privateBefore.document.token);
      assert.equal(after.document.draft, privateBefore.document.draft);
    },
  );

  await run(
    "locked snapshot, DOM, menus, notification and IPC exclude private accounts",
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
        (await state()).accounts.some(
          (account) => account.id === privateAccount.id,
        ),
        false,
      );
      const hidden = (await views()).find(
        (view) => view.partition === privateAccount.partition,
      );
      assert.equal(hidden.visible, false);
      assert.equal(hidden.muted, true);
      await page.evaluate(async (id) => {
        await window.desktop.activate(id);
        await window.desktop.testNotification(id);
        await window.desktop.pinAccount(id);
      }, privateAccount.id);
      assert.equal((await state()).active, normalNavigation.active);
      assert.equal(
        (
          await page.evaluate(
            (id) => window.desktop.editAccount(id, "BYPASS", "B"),
            privateAccount.id,
          )
        )?.ok,
        false,
      );
      assert.equal(
        (
          await command("membership", {
            accountId: privateAccount.id,
            private: false,
          })
        ).ok,
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
      await page.evaluate(
        (id) => window.desktop.activate(id),
        privateAccount.id,
      );
      const after = (await views()).find(
        (view) => view.partition === privateAccount.partition,
      );
      assert.equal(after.id, privateBefore.id);
      assert.equal(after.document.token, privateBefore.document.token);
      assert.equal(after.document.draft, privateBefore.document.draft);
    },
  );

  await run(
    "private popup is hidden and muted on return to normal space",
    async () => {
      await inPartition(
        privateAccount.partition,
        `window.open('https://chat.zalo.me/private-fixture-popup'); true`,
      );
      await eventually(
        "owned private popup",
        async () => !!(await popupState("private-fixture-popup")),
      );
      await command("lock");
      assert.deepEqual(await popupState("private-fixture-popup"), {
        visible: false,
        muted: true,
      });
    },
  );

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
    "hide, minimize and OS lock all restore normal workspace",
    async () => {
      for (const trigger of ["hide", "minimize", "lock-screen"]) {
        await client.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((win) =>
            win.webContents.getURL().startsWith("file:"),
          );
          win.restore();
          win.show();
        });
        await eventually("visible main window before auto-lock", async () =>
          client.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows().find((win) =>
              win.webContents.getURL().startsWith("file:"),
            );
            return win.isVisible() && !win.isMinimized();
          }),
        );
        await unlock();
        await client.evaluate(({ BrowserWindow, powerMonitor }, trigger) => {
          const win = BrowserWindow.getAllWindows().find((win) =>
            win.webContents.getURL().startsWith("file:"),
          );
          if (trigger === "lock-screen") powerMonitor.emit("lock-screen");
          else win[trigger]();
        }, trigger);
        await eventually(
          `${trigger} locks`,
          async () => !(await state()).privateSpace.unlocked,
        );
        assert.equal((await state()).active, normalNavigation.active);
        assert.deepEqual((await state()).providerTabs, normalNavigation.tabs);
        await client.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((win) =>
            win.webContents.getURL().startsWith("file:"),
          );
          win.restore();
          win.show();
        });
      }
    },
  );

  await run(
    "restart starts normal and preserves independent workspace navigation",
    async () => {
      await unlock();
      await page.evaluate(
        (id) => window.desktop.activate(id),
        privateAccount.id,
      );
      await stop();
      await launch();
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.equal((await state()).active, normalNavigation.active);
      assert.deepEqual((await state()).providerTabs, normalNavigation.tabs);
      assert.equal(
        (await views()).some(
          (view) => view.partition === privateAccount.partition,
        ),
        false,
      );
      await unlock();
      assert.equal((await state()).active, privateAccount.id);
      assert.deepEqual((await state()).providerTabs, privateTabs);
      assert.ok((await state()).accounts.every((account) => account.private));
      await command("lock");
    },
  );

  await run(
    "authenticated membership moves an existing account between exclusive spaces",
    async () => {
      await unlock({ accountId: "zalo", private: true });
      assert.equal(
        (await state()).accounts.find((account) => account.id === "zalo")
          ?.private,
        true,
      );
      await command("lock");
      assert.equal(
        (await state()).accounts.some((account) => account.id === "zalo"),
        false,
      );
      await unlock();
      assert.equal(
        (await command("membership", { accountId: "zalo", private: false })).ok,
        true,
      );
      assert.equal(
        (await state()).accounts.some((account) => account.id === "zalo"),
        false,
      );
      await command("lock");
      assert.equal(
        (await state()).accounts.find((account) => account.id === "zalo")
          ?.private,
        false,
      );
    },
  );

  for (const kind of ["account", "provider"]) {
    await run(
      `lock during ${kind} persistence never exposes or activates its private account`,
      async () => {
        await unlock();
        await client.evaluate(() => {
          globalThis.privateFixture.catalogPause = {
            armed: true,
            entered: false,
          };
        });
        const pending = page.evaluate(
          (kind) =>
            kind === "account"
              ? window.desktop.addAccount("gmail", "PRIVATE_RACE_ACCOUNT", "RA")
              : window.desktop.addProvider(
                  "PRIVATE_RACE_PROVIDER",
                  "https://private-race.test/",
                ),
          kind,
        );
        let normal;
        try {
          await eventually("catalog persistence paused", async () =>
            client.evaluate(
              () => globalThis.privateFixture.catalogPause?.entered === true,
            ),
          );
          await command("lock");
          normal = await state();
          assert.equal(normal.privateSpace.unlocked, false);
        } finally {
          await client.evaluate(() =>
            globalThis.privateFixture.catalogPause?.release?.(),
          );
        }
        const result = await pending;
        assert.equal(result.ok, true, result.message);
        const current = await state();
        assert.equal(current.privateSpace.unlocked, false);
        assert.equal(current.active, normal.active);
        assert.deepEqual(current.providerTabs, normal.providerTabs);
        assert.equal(
          current.accounts.some((account) => account.id === result.accountId),
          false,
        );
        if (result.providerId)
          assert.equal(
            current.providers.some(
              (provider) => provider.id === result.providerId,
            ),
            false,
          );
        assert.equal(
          (await views()).some(
            (view) =>
              view.partition === "persist:tn-account-" + result.accountId,
          ),
          false,
        );
        const catalog = JSON.parse(
          await readFile(join(root, "TinNhanDesktop", "accounts.json"), "utf8"),
        );
        assert.equal(
          catalog.accounts.find((account) => account.id === result.accountId)
            ?.private,
          true,
        );
        await unlock();
        assert.equal(
          (await state()).accounts.find(
            (account) => account.id === result.accountId,
          )?.private,
          true,
        );
        if (result.providerId)
          assert.ok(
            (await state()).providers.some(
              (provider) => provider.id === result.providerId,
            ),
          );
        await command("lock");
      },
    );
  }

  await run(
    "closing a shared custom-provider tab preserves the other workspace page and popup",
    async () => {
      const shared = await page.evaluate(() =>
        window.desktop.addProvider(
          "Shared fixture",
          "https://shared-workspace.test/",
        ),
      );
      assert.equal(shared.ok, true, shared.message);
      const normalPartition = "persist:tn-account-" + shared.accountId;
      await eventually("shared normal page", async () =>
        (await views()).some(
          (view) => view.partition === normalPartition && view.document?.token,
        ),
      );
      await inPartition(
        normalPartition,
        `document.querySelector('#draft').value = 'shared normal draft'; true`,
      );
      await unlock({ accountId: shared.accountId, private: true });
      const sharedPrivate = await addAccount(
        shared.providerId,
        "Shared private fixture",
      );
      assert.equal(
        (
          await command("membership", {
            accountId: shared.accountId,
            private: false,
          })
        ).ok,
        true,
      );
      await command("lock");
      await page.evaluate(
        (id) => window.desktop.activate(id),
        shared.accountId,
      );
      await inPartition(
        normalPartition,
        `window.open('https://shared-workspace.test/shared-normal-fixture-popup'); true`,
      );
      await eventually(
        "shared normal popup",
        async () => !!(await popupState("shared-normal-fixture-popup")),
      );
      const normalBefore = (await views()).find(
        (view) => view.partition === normalPartition,
      );
      const normalTabs = (await state()).providerTabs;
      await unlock();
      await page.evaluate(
        (id) => window.desktop.activate(id),
        sharedPrivate.id,
      );
      await inPartition(
        sharedPrivate.partition,
        `window.open('https://shared-workspace.test/shared-private-fixture-popup'); true`,
      );
      await eventually(
        "shared private popup",
        async () => !!(await popupState("shared-private-fixture-popup")),
      );
      assert.equal(
        (
          await page.evaluate(
            (id) => window.desktop.closeProvider(id),
            shared.providerId,
          )
        ).ok,
        true,
      );
      assert.equal(
        (await views()).some(
          (view) => view.partition === sharedPrivate.partition,
        ),
        false,
      );
      assert.equal(await popupState("shared-private-fixture-popup"), null);
      const retained = (await views()).find(
        (view) => view.partition === normalPartition,
      );
      assert.ok(
        retained,
        "closing private custom tab must retain normal custom page",
      );
      assert.equal(retained.id, normalBefore.id);
      assert.equal(retained.document.token, normalBefore.document.token);
      assert.equal(retained.document.draft, normalBefore.document.draft);
      assert.equal(retained.visible, false);
      assert.equal(retained.muted, true);
      assert.deepEqual(await popupState("shared-normal-fixture-popup"), {
        visible: false,
        muted: true,
      });
      await command("lock");
      assert.equal((await state()).active, shared.accountId);
      assert.deepEqual((await state()).providerTabs, normalTabs);
      assert.equal(
        (await views()).find((view) => view.partition === normalPartition).id,
        normalBefore.id,
      );
      assert.deepEqual(await popupState("shared-normal-fixture-popup"), {
        visible: true,
        muted: false,
      });
    },
  );

  await run(
    "returning to normal Settings or welcome restores warm audio without opening popups",
    async () => {
      for (const panel of ["settings", "welcome"]) {
        await page.evaluate((panel) => window.desktop[panel](), panel);
        await unlock();
        await command("lock");
        assert.equal((await state()).panel, panel);
        await assertNormalAudioRestored();
        assert.deepEqual(await popupState("shared-normal-fixture-popup"), {
          visible: false,
          muted: false,
        });
      }
    },
  );

  await run(
    "all-private catalog leaves an empty usable normal workspace",
    async () => {
      const publicIds = (await state()).accounts.map((account) => account.id);
      for (const accountId of publicIds) {
        await unlock({ accountId, private: true });
        assert.equal(
          (await state()).accounts.find((account) => account.id === accountId)
            ?.private,
          true,
        );
        await command("lock");
      }
      assert.deepEqual((await state()).accounts, []);
      assert.equal((await state()).active, "");
      assert.deepEqual((await state()).providerTabs, { open: [], pinned: [] });
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
    },
  );

  await run(
    "all-private restart starts locked without loading private pages",
    async () => {
      await stop();
      await launch();
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.deepEqual((await state()).accounts, []);
      assert.deepEqual(await views(), []);
      await unlock();
      assert.ok(
        (await state()).accounts.some(
          (account) => account.name === privateName,
        ),
      );
    },
  );

  await run(
    "interrupted outbound membership recovers private on restart",
    async () => {
      await stop();
      const path = join(root, "TinNhanDesktop", "accounts.json");
      const catalog = JSON.parse(await readFile(path, "utf8"));
      catalog.accounts.find(
        (account) => account.id === privateAccount.id,
      ).private = false;
      await writeFile(path, JSON.stringify(catalog));
      await writeFile(
        join(root, "TinNhanDesktop", "private-membership.json"),
        JSON.stringify({ accountId: privateAccount.id }),
      );
      await launch();
      assert.equal(
        (await state()).accounts.some(
          (account) => account.id === privateAccount.id,
        ),
        false,
      );
      assert.deepEqual(await views(), []);
      await unlock();
      assert.equal(
        (await state()).accounts.find(
          (account) => account.id === privateAccount.id,
        ).private,
        true,
      );
      assert.equal(
        JSON.parse(await readFile(path, "utf8")).accounts.find(
          (account) => account.id === privateAccount.id,
        ).private,
        true,
      );
    },
  );
  assert.deepEqual(
    errors,
    [],
    "renderer must not throw during workspace transitions",
  );
  console.log(
    `PASS ${checks.length} private-space smoke checks, synthetic sessions only`,
  );
} finally {
  await stop();
  await rm(root, { recursive: true, force: true });
}
