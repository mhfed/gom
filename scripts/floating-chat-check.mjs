// Isolated Electron regression. All provider content uses synthetic protocols,
// temporary appData/home and mock Keychain; never opens personal profiles.
import assert from "node:assert/strict";
import { access, mkdtemp, writeFile, rm } from "node:fs/promises";
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
const root = await mkdtemp(join(tmpdir(), "gom-floating-chat-"));
const bootstrap = join(root, "bootstrap.cjs");
const password = "fixture-floating-password";
const checks = [];
const errors = [];
let client;
let page;
const fixture = `<!doctype html><html data-floating-fixture="true"><body>
<h1>Floating fixture, no real accounts</h1><input id="contact-search-input">
<div class="chatlist"><a data-peer-id="fixture"></a></div>
<button aria-label="New message">New message</button><textarea id="draft"></textarea>
<script>document.documentElement.dataset.documentToken=crypto.randomUUID()</script>
</body></html>`;
await writeFile(
  bootstrap,
  `const e = require('electron');
const root = ${JSON.stringify(root)};
e.app.setPath('appData', root);
process.env.LOCALAPPDATA = root;
require('node:os').homedir = () => root;
globalThis.floatingFixture = {sessions: new Map(), windowEvents: []};
const fixtureWindowEmit = e.BrowserWindow.prototype.emit;
e.BrowserWindow.prototype.emit = function(name, ...args) {
  if (['hide','show','minimize','restore','focus'].includes(name)) {
    floatingFixture.windowEvents.push({time:Date.now(), name, id:this.id, url:this.webContents?.isDestroyed() ? 'destroyed' : this.webContents?.getURL(), visible:this.isVisible(), minimized:this.isMinimized()});
    if (floatingFixture.windowEvents.length>80) floatingFixture.windowEvents.shift();
  }
  return fixtureWindowEmit.call(this, name, ...args);
};
const fixtureLoadFile = e.BrowserWindow.prototype.loadFile;
e.BrowserWindow.prototype.loadFile = function(path, ...args) {
  const pause = floatingFixture.floatLoadPause;
  const loading = fixtureLoadFile.call(this, path, ...args);
  if (!pause?.armed || require('node:path').basename(String(path)) !== 'floating.html') return loading;
  pause.armed = false;
  return loading.then(() => new Promise((resolve) => {
    pause.entered = true;
    pause.release = resolve;
  }));
};
e.shell.openExternal = async () => { throw Error('Fixture attempted external navigation'); };
e.dialog.showMessageBox = async () => ({response: 1});
const original = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = original(...args);
  if (!floatingFixture.sessions.has(ses)) {
    floatingFixture.sessions.set(ses, args[0]);
    const respond = () => new Response(${JSON.stringify(fixture)}, {headers: {'content-type':'text/html; charset=utf-8'}});
    ses.protocol.handle('https', respond);
    ses.protocol.handle('http', respond);
  }
  return ses;
};
require(${JSON.stringify(entry)});`,
);
async function eventually(label, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error(`Timed out: ${label}`);
}
const state = () => page.evaluate(() => window.desktop.state());
async function run(label, work) {
  await work();
  checks.push(label);
  console.log(`PASS ${label}`);
}
const privateCommand = (action, data) =>
  page.evaluate(
    ({ action, data }) => window.desktop.privateSpace(action, data),
    { action, data },
  );
async function showMain() {
  await client.evaluate(async ({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((window) =>
      /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
    );
    const transition = (event, act) =>
      new Promise((resolve, reject) => {
        const ready = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          main.removeListener(event, ready);
          reject(Error("Native main window did not emit " + event));
        }, 5000);
        main.once(event, ready);
        act();
      });
    if (main.isMinimized()) await transition("restore", () => main.restore());
    if (!main.isVisible()) await transition("show", () => main.show());
  });
  await eventually("visible main window", () =>
    client.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((window) =>
        /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
      );
      return main.isVisible() && !main.isMinimized();
    }),
  );
  await eventually("visible main renderer", () =>
    page.evaluate(() => document.visibilityState === "visible"),
  );
}
async function unlock() {
  await showMain();
  const before = (await state()).privateSpace;
  const result = await privateCommand("unlock", { password });
  assert.equal(
    result.ok,
    true,
    result.message +
      " " +
      JSON.stringify({ before, after: (await state()).privateSpace }),
  );
}
async function shells() {
  return client.evaluate(({ BrowserWindow, screen }) =>
    BrowserWindow.getAllWindows()
      .filter((window) => window.webContents.getURL().includes("floating.html"))
      .map((window) => {
        const url = new URL(window.webContents.getURL());
        const bounds = window.getBounds();
        return {
          id: window.id,
          mode: url.searchParams.get("mode"),
          visible: window.isVisible(),
          minimized: window.isMinimized(),
          top: window.isAlwaysOnTop(),
          bounds,
          workArea: screen.getDisplayMatching(bounds).workArea,
          childIds: window.contentView.children
            .filter((view) => view.webContents)
            .map((view) => view.webContents.id),
        };
      }),
  );
}
async function floatingPage(mode) {
  let found;
  await eventually("floating " + mode + " shell", () => {
    found = client.windows().find((window) => {
      if (!window.url().includes("floating.html")) return false;
      return new URL(window.url()).searchParams.get("mode") === mode;
    });
    return !!found;
  });
  await found.waitForFunction(() => !!window.gomFloating);
  return found;
}
async function floatingCommand(action, data) {
  const panel = await floatingPage("panel");
  return panel.evaluate(
    ({ action, data }) => window.gomFloating.command(action, data),
    { action, data },
  );
}
async function nativeViews() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const results = [];
    for (const window of BrowserWindow.getAllWindows()) {
      const url = window.webContents.getURL();
      const owner = url.includes("floating.html")
        ? new URL(url).searchParams.get("mode")
        : /[/\\]index\.html(?:[?#]|$)/.test(url)
          ? "main"
          : "popup";
      for (const view of window.contentView.children) {
        const contents = view.webContents;
        if (!contents || contents.isDestroyed()) continue;
        const partition = globalThis.floatingFixture.sessions.get(
          contents.session,
        );
        if (!partition) continue;
        results.push({
          id: contents.id,
          owner,
          partition,
          visible: view.getVisible(),
          muted: contents.isAudioMuted(),
          bounds: view.getBounds(),
          document: await contents
            .executeJavaScript(
              `({
              fixture:document.documentElement.dataset.floatingFixture,
              token:document.documentElement.dataset.documentToken,
              draft:document.querySelector('#draft')?.value,
              stored:localStorage.getItem('floating-fixture')
            })`,
            )
            .catch(() => null),
        });
      }
    }
    return results;
  });
}
async function viewFor(partition) {
  return (await nativeViews()).find((view) => view.partition === partition);
}
async function inPartition(partition, expression) {
  return client.evaluate(
    async ({ webContents }, { partition, expression }) => {
      const contents = webContents
        .getAllWebContents()
        .find(
          (contents) =>
            globalThis.floatingFixture.sessions.get(contents.session) ===
            partition,
        );
      if (!contents) throw Error("Missing fixture: " + partition);
      return contents.executeJavaScript(expression, true);
    },
    { partition, expression },
  );
}
async function activate(id, partition = "persist:" + id) {
  await page.evaluate((id) => window.desktop.activate(id), id);
  await eventually(
    "fixture native page " + id,
    async () => !!(await viewFor(partition))?.document?.token,
  );
}
async function detach() {
  const result = await page.evaluate(() => window.desktop.floatChat());
  assert.equal(result.ok, true, result.message);
  await eventually(
    "detached floating state",
    async () => (await state()).floating?.detached === true,
  );
  await floatingPage("panel");
  await eventually("visible floating panel", async () =>
    (await shells()).some(
      (window) => window.mode === "panel" && window.visible,
    ),
  );
}
async function assertConcealed() {
  const current = await state();
  assert.equal(current.floating?.detached, false);
  for (const window of await shells()) assert.equal(window.visible, false);
  await floatingCommand("expand").catch(() => {});
  assert.equal((await state()).floating?.detached, false);
  for (const window of await shells()) assert.equal(window.visible, false);
}
async function addAccount(provider, name) {
  const result = await page.evaluate(
    ({ provider, name }) => window.desktop.addAccount(provider, name, "FF"),
    { provider, name },
  );
  assert.equal(result.ok, true, result.message);
  const partition = "persist:tn-account-" + result.accountId;
  await activate(result.accountId, partition);
  return { id: result.accountId, partition };
}
try {
  client = await _electron.launch({
    executablePath: electronExecutable,
    args: ["--use-mock-keychain", bootstrap],
    timeout: 20000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(10000);
  client.on("window", (window) => {
    window.on("pageerror", (error) => errors.push(error.message));
  });
  await page.waitForFunction(() => !!window.desktop);
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
  assert.equal(
    await page.evaluate(() => typeof window.desktop.floatChat),
    "function",
    "the shell exposes the floating chat action",
  );
  let normalBefore;
  await run(
    "hiding normal Gom during the first floating shell load still opens chat",
    async () => {
      await showMain();
      await activate("zalo");
      const lockVersion = (await state()).privateSpace.lockVersion;
      await client.evaluate(() => {
        globalThis.floatingFixture.floatLoadPause = {
          armed: true,
          entered: false,
        };
      });
      const pending = page.evaluate(() => window.desktop.floatChat());
      try {
        await eventually("first floating shell load paused", () =>
          client.evaluate(
            () => globalThis.floatingFixture.floatLoadPause?.entered === true,
          ),
        );
        await client.evaluate(({ BrowserWindow }) => {
          BrowserWindow.getAllWindows()
            .find((window) =>
              /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
            )
            .hide();
        });
        await eventually(
          "normal main hide processed",
          async () => (await state()).privateSpace.lockVersion !== lockVersion,
        );
      } finally {
        await client.evaluate(() =>
          globalThis.floatingFixture.floatLoadPause?.release?.(),
        );
      }
      const result = await pending;
      assert.equal(
        result.ok,
        true,
        "ordinary hide must not cancel the initial floating request",
      );
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.equal((await state()).floating.detached, true);
      await eventually(
        "floating panel opens after normal main hide",
        async () =>
          (await shells()).some(
            (window) => window.mode === "panel" && window.visible,
          ),
      );
      await showMain();
      await floatingCommand("return");
    },
  );
  await run(
    "detaching reparents the same native page without losing draft or session",
    async () => {
      await activate("zalo");
      await inPartition(
        "persist:zalo",
        `document.querySelector('#draft').value='floating normal draft';localStorage.setItem('floating-fixture','normal session');true`,
      );
      normalBefore = await viewFor("persist:zalo");
      assert.equal(normalBefore.owner, "main");
      await detach();
      const floating = await viewFor("persist:zalo");
      assert.equal(floating.owner, "panel");
      assert.equal(floating.id, normalBefore.id);
      assert.deepEqual(floating.document, normalBefore.document);
      assert.equal(floating.visible, true);
      assert.ok(
        floating.bounds.y >= 45,
        "native page sits below the floating toolbar",
      );
      assert.equal(
        await inPartition("persist:zalo", "typeof window.gomFloating"),
        "undefined",
      );
    },
  );
  await run(
    "collapse shows a safe bubble and reopen preserves native content",
    async () => {
      const panel = await floatingPage("panel");
      await panel.getByRole("button", { name: /Thu.*gọn|Thu.*bóng/ }).click();
      await eventually(
        "collapsed state",
        async () => (await state()).floating?.collapsed,
      );
      const windows = await shells();
      assert.equal(
        windows.find((window) => window.mode === "panel").visible,
        false,
      );
      const bubble = windows.find((window) => window.mode === "bubble");
      assert.equal(bubble.visible, true);
      assert.equal(bubble.bounds.width, 72);
      assert.equal(bubble.bounds.height, 72);
      assert.equal((await viewFor("persist:zalo")).visible, false);
      const bubblePage = await floatingPage("bubble");
      assert.equal(
        (await bubblePage.locator("body").innerText()).includes(
          "floating normal draft",
        ),
        false,
      );
      await bubblePage.evaluate(() => window.gomFloating.command("expand"));
      await eventually(
        "expanded state",
        async () => !(await state()).floating?.collapsed,
      );
      const reopened = await viewFor("persist:zalo");
      assert.equal(reopened.id, normalBefore.id);
      assert.deepEqual(reopened.document, normalBefore.document);
      assert.equal(reopened.visible, true);
    },
  );
  await run(
    "pin toggle and bubble dragging stay inside the usable display",
    async () => {
      await floatingCommand("pin");
      assert.equal((await state()).floating.pinned, false);
      assert.equal(
        (await shells()).find((window) => window.mode === "panel").top,
        false,
      );
      await floatingCommand("pin");
      assert.equal((await state()).floating.pinned, true);
      await floatingCommand("collapse");
      const bubble = await floatingPage("bubble");
      for (const side of ["left", "right"]) {
        const current = (await shells()).find(
          (window) => window.mode === "bubble",
        );
        const targetX =
          side === "left"
            ? current.workArea.x + 12
            : current.workArea.x +
              current.workArea.width -
              current.bounds.width -
              12;
        const movement = {
          dx: targetX - current.bounds.x,
          dy:
            current.workArea.y +
            current.workArea.height -
            current.bounds.height -
            12 -
            current.bounds.y,
        };
        await bubble.evaluate(
          (movement) => window.gomFloating.command("drag", movement),
          movement,
        );
        await eventually("bubble snapped " + side, async () => {
          const window = (await shells()).find(
            (window) => window.mode === "bubble",
          );
          const b = window.bounds,
            a = window.workArea;
          return side === "left"
            ? Math.abs(b.x - a.x) <= 32
            : Math.abs(a.x + a.width - b.x - b.width) <= 32;
        });
        const window = (await shells()).find(
          (window) => window.mode === "bubble",
        );
        const b = window.bounds,
          a = window.workArea;
        assert.ok(b.x >= a.x && b.y >= a.y);
        assert.ok(
          b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height,
        );
        assert.ok(a.y + a.height - b.y - b.height <= 32);
      }
      await floatingCommand("expand");
    },
  );
  await run(
    "main window navigation does not steal an unrelated floating page",
    async () => {
      await activate("telegram");
      assert.equal((await state()).active, "telegram");
      assert.equal((await viewFor("persist:zalo")).owner, "panel");
      assert.equal((await state()).floating.detached, true);
      await client.evaluate(({ BrowserWindow }) => {
        const main = BrowserWindow.getAllWindows().find((window) =>
          /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
        );
        main.hide();
      });
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.equal((await state()).floating.detached, true);
      assert.equal(
        (await shells()).find((window) => window.mode === "panel").visible,
        true,
      );
      await showMain();
      await floatingCommand("return");
      await eventually(
        "native page returned",
        async () => (await viewFor("persist:zalo"))?.owner === "main",
      );
      assert.equal((await state()).active, "zalo");
      assert.equal((await viewFor("persist:zalo")).id, normalBefore.id);
      assert.deepEqual(
        (await viewFor("persist:zalo")).document,
        normalBefore.document,
      );
    },
  );
  await run(
    "activating the detached account returns it to Gom and closing the panel collapses",
    async () => {
      await detach();
      await client.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()
          .find((window) =>
            window.webContents.getURL().includes("floating.html?mode=panel"),
          )
          .close();
      });
      await eventually(
        "native close collapsed",
        async () => (await state()).floating?.collapsed,
      );
      await activate("zalo");
      assert.equal((await state()).floating.detached, false);
      assert.equal((await viewFor("persist:zalo")).owner, "main");
      assert.equal((await viewFor("persist:zalo")).id, normalBefore.id);
    },
  );
  let privateAccount;
  let privateBefore;
  await run(
    "entering private space conceals normal floating windows",
    async () => {
      await detach();
      assert.equal((await privateCommand("setup", { password })).ok, true);
      assert.equal((await state()).privateSpace.unlocked, true);
      await assertConcealed();
      const normal = await viewFor("persist:zalo");
      assert.equal(normal.owner, "main");
      assert.equal(normal.visible, false);
      assert.equal(normal.muted, true);
      privateAccount = await addAccount("zalo", "PRIVATE_FLOAT_FIXTURE");
      await inPartition(
        privateAccount.partition,
        `document.querySelector('#draft').value='private floating draft';localStorage.setItem('floating-fixture','private session');true`,
      );
      privateBefore = await viewFor(privateAccount.partition);
    },
  );
  await run(
    "locking private space conceals panel and bubble and denies stale expansion",
    async () => {
      await detach();
      await floatingCommand("collapse");
      await privateCommand("lock");
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.equal(
        JSON.stringify(await state()).includes("PRIVATE_FLOAT_FIXTURE"),
        false,
      );
      assert.equal(
        JSON.stringify(await state()).includes(privateAccount.id),
        false,
      );
      await assertConcealed();
      const view = await viewFor(privateAccount.partition);
      assert.equal(view.owner, "main");
      assert.equal(view.visible, false);
      assert.equal(view.muted, true);
      await unlock();
      await activate(privateAccount.id, privateAccount.partition);
      assert.equal(
        (await viewFor(privateAccount.partition)).id,
        privateBefore.id,
      );
      assert.deepEqual(
        (await viewFor(privateAccount.partition)).document,
        privateBefore.document,
      );
    },
  );
  await run(
    "private floating chat disappears on hide, minimize, OS lock and suspend",
    async () => {
      for (const trigger of ["hide", "minimize", "lock-screen", "suspend"]) {
        await showMain();
        if (!(await state()).privateSpace.unlocked) await unlock();
        await activate(privateAccount.id, privateAccount.partition);
        await detach();
        await client.evaluate(({ BrowserWindow, powerMonitor }, trigger) => {
          const main = BrowserWindow.getAllWindows().find((window) =>
            /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
          );
          if (trigger === "hide" || trigger === "minimize") main[trigger]();
          else powerMonitor.emit(trigger);
        }, trigger);
        await eventually(
          trigger + " locked private floating",
          async () => !(await state()).privateSpace.unlocked,
        );
        await assertConcealed();
        if (trigger === "suspend")
          await client.evaluate(({ powerMonitor }) =>
            powerMonitor.emit("resume"),
          );
      }
      await showMain();
    },
  );
  await run(
    "archiving and closing a detached account tab never leave a floating surface",
    async () => {
      const extra = await addAccount("telegram", "Floating archive fixture");
      await detach();
      const archived = await page.evaluate(
        (id) => window.desktop.archiveAccount(id),
        extra.id,
      );
      assert.equal(archived.ok, true, archived.message);
      await assertConcealed();
      assert.equal(await viewFor(extra.partition), undefined);
      await activate("zalo");
      await detach();
      const closed = await page.evaluate(() =>
        window.desktop.closeProvider("zalo"),
      );
      assert.equal(closed.ok, true, closed.message);
      await assertConcealed();
      assert.equal((await state()).providerTabs.open.includes("zalo"), false);
      assert.equal((await viewFor("persist:zalo")).id, normalBefore.id);
    },
  );
  await run(
    "native application reload and Back target the focused floating account",
    async () => {
      await activate("zalo");
      await detach();
      await activate("telegram");
      const zaloBefore = await viewFor("persist:zalo");
      const telegramBefore = await viewFor("persist:telegram");
      await client.evaluate(({ BrowserWindow, app }) => {
        const panel = BrowserWindow.getAllWindows().find((window) =>
          window.webContents.getURL().includes("floating.html?mode=panel"),
        );
        app.focus({ steal: true });
        panel.show();
        panel.focus();
        panel.contentView.children
          .find((view) => view.webContents)
          ?.webContents.focus();
      });
      await eventually("focused floating panel", () =>
        client.evaluate(
          ({ BrowserWindow }) =>
            !!BrowserWindow.getFocusedWindow()
              ?.webContents.getURL()
              .includes("floating.html?mode=panel"),
        ),
      );
      await client.evaluate(({ Menu, BrowserWindow }) => {
        const space = Menu.getApplicationMenu().items.find(
          (item) => item.label === "Không gian",
        );
        const reload = space.submenu.items.find(
          (item) => item.label === "Tải lại nền tảng",
        );
        reload.click(reload, BrowserWindow.getFocusedWindow(), {});
      });
      await eventually("native reload settled", async () => {
        const zalo = await viewFor("persist:zalo");
        const telegram = await viewFor("persist:telegram");
        return (
          !!zalo?.document?.token &&
          !!telegram?.document?.token &&
          (zalo.document.token !== zaloBefore.document.token ||
            telegram.document.token !== telegramBefore.document.token)
        );
      });
      assert.notEqual(
        (await viewFor("persist:zalo")).document.token,
        zaloBefore.document.token,
        "reload must reload the focused floating Zalo page",
      );
      assert.equal(
        (await viewFor("persist:telegram")).document.token,
        telegramBefore.document.token,
        "reload must not disturb the other account selected in main Gom",
      );
      const previousUrl = await inPartition("persist:zalo", "location.href");
      await inPartition(
        "persist:zalo",
        "history.pushState({}, '', location.pathname+'?floating-back');true",
      );
      await client.evaluate(({ Menu, BrowserWindow, app }) => {
        const panel = BrowserWindow.getAllWindows().find((window) =>
          window.webContents.getURL().includes("floating.html?mode=panel"),
        );
        app.focus({ steal: true });
        panel.focus();
        panel.contentView.children
          .find((view) => view.webContents)
          ?.webContents.focus();
        const space = Menu.getApplicationMenu().items.find(
          (item) => item.label === "Không gian",
        );
        const back = space.submenu.items.find(
          (item) => item.label === "Quay lại",
        );
        back.click(back, panel, {});
      });
      await eventually(
        "floating native Back",
        async () =>
          (await inPartition("persist:zalo", "location.href")) === previousUrl,
      );
      assert.equal(
        (await viewFor("persist:telegram")).document.token,
        telegramBefore.document.token,
      );
      await floatingCommand("return");
    },
  );
  await run(
    "quitting with a detached page exits without orphan windows",
    async () => {
      await activate("telegram");
      await detach();
      const exited = new Promise((resolve) =>
        client
          .process()
          .once("exit", (code, signal) => resolve({ code, signal })),
      );
      await client.evaluate(({ app }) => app.quit()).catch(() => {});
      const result = await Promise.race([
        exited,
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("Quit did not exit")), 15000).unref(),
        ),
      ]);
      assert.deepEqual(result, { code: 0, signal: null });
    },
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${checks.length} floating chat groups, synthetic sessions only`,
  );
} catch (error) {
  console.error(
    "Fixture failure state",
    JSON.stringify(await state().catch(() => null)),
  );
  console.error(
    "Fixture native window events",
    JSON.stringify(
      await client
        ?.evaluate(() => globalThis.floatingFixture.windowEvents)
        .catch(() => null),
    ),
  );
  throw error;
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
