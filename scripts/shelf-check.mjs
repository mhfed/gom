// Isolated acceptance: only temporary appData/home, synthetic provider protocols,
// mock Keychain and test-owned native dialog/crypto boundaries. No real accounts.
import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import electronExecutable from "electron";

const project = fileURLToPath(new URL("..", import.meta.url));
const appArchive = process.env.GOM_SMOKE_APP_ASAR;
const entry = join(appArchive || project, "dist/main.cjs");
await access(appArchive || entry);
const root = await mkdtemp(join(tmpdir(), "gom-shelf-"));
const bootstrap = join(root, "bootstrap.cjs");
const password = "fixture-shelf-password";
const checks = [];
const errors = [];
const geometryOnly = process.argv.includes("--geometry-only");
const lifecycleOnly = process.argv.includes("--lifecycle-only");
const contextOnly = process.argv.includes("--context-only");
let client;
let page;
const fixture = `<!doctype html><html data-shelf-fixture="true"><body>
<h1>Shelf fixture, no real accounts</h1><input id="contact-search-input">
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
globalThis.shelfFixture = { sessions: new Map(), errors: [], clipboard: [], openPaths: [], savePath: null, messageBoxes: [] };
process.on('uncaughtExceptionMonitor', error => shelfFixture.errors.push(error.message));
const fs = require('node:fs/promises');
e.app.on('will-quit', () => require('node:fs').writeFileSync(require('node:path').join(root, 'quit-observed.json'), JSON.stringify({exports:require('node:fs').readdirSync(root).filter(name => name.startsWith('.gom-export-'))})));
async function pauseAt(kind) {
  const pause = shelfFixture.pause;
  if (pause?.armed && pause.kind === kind) {
    pause.armed = false; pause.entered = true;
    await new Promise(resolve => { pause.release = resolve; });
  }
}
const readFile = fs.readFile.bind(fs);
fs.readFile = async (path, ...args) => {
  if (String(path).includes('shelf')) await pauseAt('read');
  return readFile(path, ...args);
};
const open = fs.open.bind(fs);
fs.open = async (path,...args) => {
  const handle=await open(path,...args);
  if(String(path).endsWith('.blob')) {
    const read=handle.read.bind(handle);
    handle.read=async (...args)=>{await pauseAt('read');return read(...args);};
  }
  if(require('node:path').basename(String(path)).startsWith('.gom-export-')) {
    const sync=handle.sync.bind(handle);
    handle.sync=async()=>{await pauseAt('export-write');return sync();};
  }
  return handle;
};
e.safeStorage.isAsyncEncryptionAvailable = async () => !require('node:fs').existsSync(require('node:path').join(root,'crypto-off'));
e.safeStorage.encryptStringAsync = async text => Buffer.from('fixture-key:' + text);
e.safeStorage.decryptStringAsync = async bytes => {
  const value = bytes.toString();
  if (!value.startsWith('fixture-key:')) throw Error('Invalid fixture wrapped key');
  return {result:value.slice(12), shouldReEncrypt:false};
};
e.clipboard.read = async () => { await pauseAt('clipboard'); return shelfFixture.clipboard; };
e.clipboard.write = async items => { shelfFixture.clipboard = items; };
e.clipboard.writeText = async text => {
  shelfFixture.clipboard = [new e.ClipboardItem({'text/plain':text})];
};
e.dialog.showOpenDialog = async () => {
  await pauseAt('picker');
  return {canceled:false, filePaths:shelfFixture.openPaths};
};
e.dialog.showSaveDialog = async () => {
  await pauseAt('save');
  return {canceled:!shelfFixture.savePath, filePath:shelfFixture.savePath};
};
e.shell.openExternal = async () => { throw Error('Fixture attempted external navigation'); };
e.dialog.showMessageBox = async (...args) => {
  const options = args.at(-1);
  shelfFixture.messageBoxes.push({message:options.message, detail:options.detail});
  return {response:1};
};
const buildMenu = e.Menu.buildFromTemplate.bind(e.Menu);
e.Menu.buildFromTemplate = (...args) => {
  const menu = buildMenu(...args);
  if (menu.items.some(item => item.label === 'Lưu đoạn chọn vào Khay')) {
    shelfFixture.contextMenu = menu;
    menu.popup = () => {};
  }
  return menu;
};
const original = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = original(...args);
  if (!shelfFixture.sessions.has(ses)) {
    shelfFixture.sessions.set(ses, args[0]);
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
  assert.equal(
    await page.evaluate(() => typeof window.desktop.shelf),
    "function",
    "the trusted shell must expose the shelf request bridge",
  );
}
async function run(label, work) {
  if (geometryOnly && !label.startsWith("native width reservation")) return;
  if (lifecycleOnly && !label.startsWith("lifecycle quit")) return;
  if (contextOnly && !label.startsWith("context-menu failure")) return;
  await work();
  checks.push(label);
  console.log(`PASS ${label}`);
}
const privateCommand = (action, data) =>
  page.evaluate(
    ({ action, data }) => window.desktop.privateSpace(action, data),
    { action, data },
  );
async function shelf(action, data = {}) {
  const lockVersion = (await state()).privateSpace.lockVersion;
  return page.evaluate((request) => window.desktop.shelf(request), {
    action,
    lockVersion,
    ...data,
  });
}
async function good(action, data) {
  const result = await shelf(action, data);
  assert.equal(result.ok, true, result.message);
  return result;
}
async function list() {
  return (await good("list")).snapshot;
}
async function clipboardPut(type, bytes) {
  await client.evaluate(
    ({ ClipboardItem }, { type, bytes }) => {
      globalThis.shelfFixture.clipboard = [
        new ClipboardItem({ [type]: new Blob([Buffer.from(bytes)]) }),
      ];
    },
    { type, bytes: [...bytes] },
  );
}
async function clipboardGet(type) {
  return Buffer.from(
    await client.evaluate(async (_, type) => {
      const item = globalThis.shelfFixture.clipboard.find((item) =>
        item.types.includes(type),
      );
      if (!item) return [];
      return [
        ...new Uint8Array(await (await item.getType(type)).arrayBuffer()),
      ];
    }, type),
  );
}
async function pick(paths) {
  await client.evaluate((_, paths) => {
    globalThis.shelfFixture.openPaths = paths;
  }, paths);
  return good("pick-files");
}
async function exportTo(id, path) {
  await client.evaluate((_, path) => {
    globalThis.shelfFixture.savePath = path;
  }, path);
  await good("export", { id });
  return readFile(path);
}
async function stop() {
  if (!client) return;
  assert.deepEqual(
    await client.evaluate(() => globalThis.shelfFixture.errors),
    [],
  );
  const process = client.process();
  const exited = new Promise((resolve) =>
    process.once("exit", (code, signal) => resolve({ code, signal })),
  );
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  assert.deepEqual(
    await Promise.race([
      exited,
      new Promise((_, reject) =>
        setTimeout(() => reject(Error("Quit did not exit")), 15000).unref(),
      ),
    ]),
    { code: 0, signal: null },
  );
  await client.close().catch(() => {});
  client = undefined;
}
async function unlock() {
  const delay = (await state()).privateSpace.retryAt - Date.now();
  if (delay > 0)
    await new Promise((resolve) => setTimeout(resolve, delay + 30));
  const result = await privateCommand("unlock", { password });
  assert.equal(result.ok, true, result.message);
}
async function switchBack() {
  assert.equal((await privateCommand("lock")).ok, true);
  await unlock();
}
async function race(kind, action, data, transition = switchBack) {
  await client.evaluate((_, kind) => {
    globalThis.shelfFixture.pause = { kind, armed: true, entered: false };
  }, kind);
  const pending = shelf(action, data);
  try {
    await eventually(`${kind} boundary paused`, () =>
      client.evaluate(() => globalThis.shelfFixture.pause.entered),
    );
    await transition();
  } finally {
    await client.evaluate(() => globalThis.shelfFixture.pause?.release?.());
  }
  const result = await pending;
  assert.equal(result.ok, false, `${action} must reject its former epoch`);
  assert.equal(result.dataUrl, undefined, "stale preview must return no bytes");
  assert.equal(
    result.snapshot,
    undefined,
    "stale result must return no snapshot",
  );
}
async function views() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const result = [];
    for (const window of BrowserWindow.getAllWindows()) {
      const url = window.webContents.getURL();
      const owner = url.includes("floating.html")
        ? "floating"
        : url.includes("index.html")
          ? "main"
          : "other";
      for (const view of window.contentView.children) {
        const wc = view.webContents;
        const partition =
          wc && globalThis.shelfFixture.sessions.get(wc.session);
        if (!partition) continue;
        result.push({
          id: wc.id,
          owner,
          partition,
          visible: view.getVisible(),
          bounds: view.getBounds(),
          document: await wc
            .executeJavaScript(
              `({token:document.documentElement.dataset.documentToken,draft:document.querySelector('#draft')?.value})`,
            )
            .catch(() => null),
        });
      }
    }
    return result;
  });
}
async function viewFor(partition) {
  return (await views()).find((view) => view.partition === partition);
}
async function activate(id, partition = `persist:${id}`) {
  await page.evaluate((id) => window.desktop.activate(id), id);
  await eventually(
    `${partition} loaded`,
    async () => !!(await viewFor(partition))?.document?.token,
  );
  return viewFor(partition);
}
async function size(width) {
  await client.evaluate(({ BrowserWindow }, width) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("index.html"),
    );
    // Emulate a work area smaller than the normal 940px minimum.
    main.setMinimumSize(400, 600);
    main.setContentSize(width, 760);
  }, width);
  await eventually("window content resized", () =>
    page.evaluate((width) => innerWidth === width, width),
  );
}
async function tree(dir) {
  const result = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      for (const [key, value] of await tree(path)) result.set(key, value);
    else if (entry.isFile()) result.set(path, await readFile(path));
  }
  return result;
}

try {
  await launch();
  let textId, linkId, imageId, fileId, privateTextId, privateImageId;
  const text = "SHELF_NORMAL_TEXT_872\nDòng hai\t giữ  khoảng trắng";
  const link = "https://example.test/catalog?q=shelf";
  const fileName = "SHELF_PRIVATE_SOURCE_872.bin";
  const source = join(root, fileName);
  const fileBytes = Buffer.from([0, 255, 13, 10, 19, 128, 42, 0, 78]);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await run(
    "text, link, image and immutable file copies survive a real restart",
    async () => {
      assert.equal((await state()).shelf.open, false);
      assert.equal((await state()).shelf.count, 0);
      await good("add-text", { text });
      await clipboardPut("text/plain", Buffer.from(link));
      await good("clipboard");
      await clipboardPut("image/png", png);
      await good("clipboard");
      await writeFile(source, fileBytes);
      await pick([source]);
      const before = await list();
      assert.equal(before.items.length, 4);
      textId = before.items.find((item) => item.kind === "text").id;
      linkId = before.items.find((item) => item.kind === "link").id;
      imageId = before.items.find((item) => item.kind === "image").id;
      fileId = before.items.find((item) => item.kind === "file").id;
      assert.equal(before.items.find((item) => item.id === textId).text, text);
      assert.equal(before.items.find((item) => item.id === linkId).text, link);
      assert.equal(
        before.items.find((item) => item.id === fileId).name,
        fileName,
      );
      await writeFile(source, "SOURCE_CHANGED");
      await rm(source);
      await good("surface", { open: true });
      await stop();
      await launch();
      assert.equal(
        (await state()).shelf.open,
        false,
        "restart must start with shelf closed",
      );
      const after = await list();
      assert.deepEqual(after.items, before.items);
      assert.deepEqual(
        await exportTo(fileId, join(root, "exported.bin")),
        fileBytes,
      );
      await good("copy", { id: textId });
      assert.equal((await clipboardGet("text/plain")).toString(), text);
      await good("copy", { id: linkId });
      assert.equal((await clipboardGet("text/plain")).toString(), link);
      await good("copy", { id: imageId });
      const copied = await clipboardGet("image/png");
      assert.ok(copied.length > 0);
      assert.equal(
        await client
          .evaluate(
            ({ nativeImage }, bytes) => {
              const image = nativeImage.createFromBuffer(Buffer.from(bytes));
              return image.isEmpty() ? null : image.getSize();
            },
            [...copied],
          )
          .then((size) => JSON.stringify(size)),
        JSON.stringify({ width: 1, height: 1 }),
      );
      const preview = await good("preview", { id: imageId });
      assert.match(preview.dataUrl, /^data:image\/(?:png|jpeg|webp);base64,/);
    },
  );
  await run(
    "pin, clear and hostile requests preserve permitted items",
    async () => {
      await good("pin", { id: textId, pinned: true });
      assert.equal((await list()).items[0].id, textId);
      await good("clear");
      assert.deepEqual(
        (await list()).items.map((item) => item.id),
        [textId],
      );
      for (const request of [
        { action: "add-text", text: "x".repeat(65537) },
        { action: "remove", id: "../../key.enc" },
        { action: "copy", id: fileId },
        { action: "unexpected" },
      ])
        assert.equal((await shelf(request.action, request)).ok, false);
      assert.equal((await list()).items[0].text, text);
      assert.equal((await state()).shelf.count, 1);
      assert.equal(JSON.stringify((await state()).shelf).includes(text), false);
    },
  );
  await run(
    "namespace ownership and epochs deny cross-space and switch-back requests",
    async () => {
      const oldEpoch = (await state()).privateSpace.lockVersion;
      assert.equal((await privateCommand("setup", { password })).ok, true);
      assert.equal((await list()).items.length, 0);
      assert.equal((await state()).shelf.open, false);
      await good("add-text", { text: "PRIVATE_SHELF_TEXT_872" });
      await clipboardPut("image/png", png);
      await good("clipboard");
      const privateItems = (await list()).items;
      privateTextId = privateItems.find((item) => item.kind === "text").id;
      privateImageId = privateItems.find((item) => item.kind === "image").id;
      for (const action of ["copy", "remove", "pin", "preview", "export"])
        assert.equal((await shelf(action, { id: textId })).ok, false);
      assert.equal(
        (await shelf("add-text", { text: "stale", lockVersion: oldEpoch })).ok,
        false,
      );
      const privateEpoch = (await state()).privateSpace.lockVersion;
      await privateCommand("lock");
      assert.equal(
        (await shelf("list", { namespace: "private", path: source })).ok,
        false,
        "renderer arguments cannot select another namespace or disk path",
      );
      assert.deepEqual(
        (await list()).items.map((item) => item.id),
        [textId],
      );
      for (const action of ["copy", "remove", "pin", "preview", "export"])
        assert.equal((await shelf(action, { id: privateTextId })).ok, false);
      assert.equal(
        JSON.stringify(await state()).includes("PRIVATE_SHELF_TEXT_872"),
        false,
      );
      await unlock();
      assert.equal(
        (await shelf("list", { lockVersion: privateEpoch })).ok,
        false,
      );
      assert.equal((await list()).items.length, 2);
    },
  );
  await run(
    "private shelf DOM, composer and search clear on lock and light/dark layouts remain usable",
    async () => {
      await good("surface", { open: true });
      await page.locator("#shelf-panel").waitFor({ state: "visible" });
      await eventually("private text displayed", async () =>
        (await page.locator("#shelf-list").innerText()).includes(
          "PRIVATE_SHELF_TEXT_872",
        ),
      );
      await page.locator("#shelf-search").fill("PRIVATE_SHELF_TEXT_872");
      await page.locator("#shelf-text").fill("PRIVATE_UNSAVED_COMPOSER");
      await privateCommand("lock");
      await page.locator("#shelf-panel").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#shelf-search").inputValue(), "");
      assert.equal(await page.locator("#shelf-text").inputValue(), "");
      assert.equal(
        (await page.locator("body").textContent()).includes(
          "PRIVATE_SHELF_TEXT_872",
        ),
        false,
      );
      assert.equal(
        (await page.locator("body").textContent()).includes(
          "PRIVATE_UNSAVED_COMPOSER",
        ),
        false,
      );
      await size(900);
      await good("surface", { open: true });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => window.desktop.setTheme(theme), theme);
        await eventually(`${theme} shelf fits narrow viewport`, () =>
          page.evaluate(() => {
            const box = document
              .querySelector("#shelf-panel")
              .getBoundingClientRect();
            return (
              box.width > 0 &&
              box.left >= 0 &&
              box.right <= innerWidth &&
              box.top >= 52
            );
          }),
        );
        assert.equal(
          await page.locator("#shelf-toggle").getAttribute("aria-expanded"),
          "true",
        );
      }
      await page.locator("#shelf-search").focus();
      await page.keyboard.press("Escape");
      await page.locator("#shelf-panel").waitFor({ state: "hidden" });
      assert.equal((await state()).shelf.open, false);
      await unlock();
    },
  );
  await run(
    "picker, clipboard, preview, copy and save results cancel after privacy transitions",
    async () => {
      await writeFile(source, fileBytes);
      await client.evaluate((_, source) => {
        globalThis.shelfFixture.openPaths = [source];
      }, source);
      const before = (await list()).items;
      await race("picker", "pick-files");
      assert.deepEqual((await list()).items, before);
      await clipboardPut("text/plain", Buffer.from("CANCELLED_CLIPBOARD_TEXT"));
      await race("clipboard", "clipboard");
      assert.deepEqual((await list()).items, before);
      await race("read", "preview", { id: privateImageId });
      await clipboardPut("text/plain", Buffer.from("CLIPBOARD_SENTINEL"));
      await race("read", "copy", { id: privateImageId });
      assert.equal(
        (await clipboardGet("text/plain")).toString(),
        "CLIPBOARD_SENTINEL",
      );
      await pick([source]);
      const id = (await list()).items.find((item) => item.kind === "file").id;
      const destination = join(root, "cancelled-export.bin");
      await writeFile(destination, "PREEXISTING_USER_BYTES");
      await client.evaluate((_, path) => {
        globalThis.shelfFixture.savePath = path;
      }, destination);
      await race("save", "export", { id });
      assert.equal(
        (await readFile(destination)).toString(),
        "PREEXISTING_USER_BYTES",
      );
      await race("read", "export", { id });
      assert.equal(
        (await readFile(destination)).toString(),
        "PREEXISTING_USER_BYTES",
      );
      await race("export-write", "export", { id });
      assert.equal(
        (await readFile(destination)).toString(),
        "PREEXISTING_USER_BYTES",
      );
      assert.equal(
        (await readdir(root)).some((name) => name.startsWith(".gom-export-")),
        false,
      );
      await privateCommand("lock");
      const normalBefore = (await list()).items;
      await race("picker", "pick-files", undefined, async () => {
        await unlock();
        await privateCommand("lock");
      });
      assert.deepEqual(
        (await list()).items,
        normalBefore,
        "normal-private-normal must cancel its original picker",
      );
    },
  );
  await run(
    "native width reservation, drawer and tab switches preserve documents and drafts",
    async () => {
      await size(1100);
      await activate("zalo");
      await client.evaluate(({ webContents }) => {
        const wc = webContents
          .getAllWebContents()
          .find(
            (w) =>
              globalThis.shelfFixture.sessions.get(w.session) ===
              "persist:zalo",
          );
        return wc.executeJavaScript(
          "document.querySelector('#draft').value='SHELF_DRAFT_872';true",
        );
      });
      const before = await viewFor("persist:zalo");
      assert.equal(
        await client.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .find(
              (w) =>
                globalThis.shelfFixture.sessions.get(w.session) ===
                "persist:zalo",
            )
            .executeJavaScript("typeof window.desktop"),
        ),
        "undefined",
        "provider pages receive no shelf bridge",
      );
      await good("surface", { open: true });
      await eventually(
        "wide shelf reserves native width",
        async () =>
          (await viewFor("persist:zalo")).bounds.width ===
          before.bounds.width - 340,
      );
      assert.equal((await viewFor("persist:zalo")).visible, true);
      assert.deepEqual(
        (await viewFor("persist:zalo")).document,
        before.document,
      );
      await activate("telegram");
      assert.equal((await state()).shelf.open, true);
      await activate("zalo");
      await size(900);
      await eventually(
        "drawer conceals native view",
        async () => !(await viewFor("persist:zalo")).visible,
      );
      await size(400);
      await client.evaluate(({ BrowserWindow, app }) => {
        const main = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("index.html"),
        );
        app.focus({ steal: true });
        main.show();
        main.focus();
        main.webContents.focus();
      });
      const shellFocused = () =>
        client.evaluate(({ BrowserWindow, webContents }) => {
          const main = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("index.html"),
          );
          return (
            main.isFocused() &&
            webContents.getFocusedWebContents()?.id === main.webContents.id
          );
        });
      await eventually("narrow main shell focused", shellFocused);
      await activate("telegram");
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const narrowActivation = {
        visible: (await viewFor("persist:telegram")).visible,
        shellFocused: await shellFocused(),
      };
      await client.evaluate(({ BrowserWindow, app }) => {
        const main = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("index.html"),
        );
        main.webContents.focus();
        app.emit("second-instance");
      });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const narrowShowWindow = {
        visible: (await viewFor("persist:telegram")).visible,
        shellFocused: await shellFocused(),
      };
      assert.deepEqual(
        { activate: narrowActivation, showWindow: narrowShowWindow },
        {
          activate: { visible: false, shellFocused: true },
          showWindow: { visible: false, shellFocused: true },
        },
        "drawer activation and second-instance keep native content hidden and keyboard focus in the shell",
      );
      await size(1100);
      await eventually(
        "wide resize restores selected provider beside shelf",
        async () => {
          const view = await viewFor("persist:telegram");
          return view.visible && view.bounds.x + view.bounds.width === 760;
        },
      );
      assert.equal((await state()).shelf.open, true);
      await activate("zalo");
      await size(900);
      await good("surface", { open: false });
      await eventually(
        "drawer close restores native view",
        async () => (await viewFor("persist:zalo")).visible,
      );
      assert.equal((await viewFor("persist:zalo")).id, before.id);
      assert.deepEqual(
        (await viewFor("persist:zalo")).document,
        before.document,
      );
      await size(1100);
      await good("surface", { open: true });
      await page.evaluate(() => window.desktop.settings());
      assert.equal(
        (await state()).shelf.open,
        false,
        "settings closes shelf before modal",
      );
      await activate("zalo");
    },
  );
  await run(
    "main shelf toggles never reclaim a floating native page",
    async () => {
      const result = await page.evaluate(() => window.desktop.floatChat());
      assert.equal(result.ok, true, result.message);
      await eventually(
        "view detached",
        async () => (await viewFor("persist:zalo"))?.owner === "floating",
      );
      const before = await viewFor("persist:zalo");
      await good("surface", { open: true });
      await good("surface", { open: false });
      const after = await viewFor("persist:zalo");
      assert.equal(after.owner, "floating");
      assert.equal(after.id, before.id);
      assert.deepEqual(after.document, before.document);
      const panel = client
        .windows()
        .find((window) => window.url().includes("floating.html?mode=panel"));
      await panel.evaluate(() => window.gomFloating.command("return"));
    },
  );
  await run(
    "encrypted storage contains no fixture text or filenames and crypto outage preserves bytes",
    async () => {
      await stop();
      const storage = join(root, "TinNhanDesktop", "shelf");
      const before = await tree(storage);
      assert.ok(before.size > 0);
      for (const bytes of before.values())
        for (const secret of [text, "PRIVATE_SHELF_TEXT_872", fileName])
          assert.equal(bytes.includes(Buffer.from(secret)), false);
      await writeFile(join(root, "crypto-off"), "1");
      await launch();
      const outageResult = await shelf("list");
      assert.equal(outageResult.ok, true);
      assert.equal(outageResult.snapshot.unavailable, true);
      assert.equal((await state()).shelf.unavailable, true);
      assert.equal(
        (await shelf("add-text", { text: "NO_PLAINTEXT_FALLBACK" })).ok,
        false,
      );
      await stop();
      assert.deepEqual(await tree(storage), before);
      await rm(join(root, "crypto-off"));
      await launch();
      assert.equal((await list()).items[0].text, text);
      await unlock();
      const privateItems = (await list()).items;
      assert.ok(privateItems.some((item) => item.id === privateTextId));
      assert.ok(privateItems.some((item) => item.id === privateImageId));
      assert.deepEqual(
        await exportTo(
          privateItems.find((item) => item.kind === "file").id,
          join(root, "private-restart.bin"),
        ),
        fileBytes,
      );
      await privateCommand("lock");
      await stop();
      const index = join(storage, "normal", "index.enc");
      const original = await readFile(index);
      const damaged = Buffer.from(original);
      damaged[damaged.length - 1] ^= 255;
      await writeFile(index, damaged);
      const corrupted = await tree(storage);
      await launch();
      const result = await shelf("list");
      assert.equal(result.ok, true);
      assert.equal(result.snapshot.unavailable, true);
      assert.equal((await state()).shelf.unavailable, true);
      assert.equal(
        (await shelf("add-text", { text: "MUST_NOT_REPLACE_CORRUPT_INDEX" }))
          .ok,
        false,
      );
      await stop();
      assert.deepEqual(
        await tree(storage),
        corrupted,
        "corruption must retain all original bytes",
      );
    },
  );
  await run(
    "context-menu failure shows visible scoped feedback for rejected selection",
    async () => {
      await stop();
      await rm(join(root, "TinNhanDesktop"), { recursive: true, force: true });
      await launch();
      await activate("zalo");
      const before = await list();
      const fired = await client.evaluate(({ webContents }) => {
        const contents = webContents
          .getAllWebContents()
          .find(
            (wc) =>
              globalThis.shelfFixture.sessions.get(wc.session) ===
              "persist:zalo",
          );
        globalThis.shelfFixture.messageBoxes = [];
        contents.emit(
          "context-menu",
          { preventDefault() {} },
          {
            selectionText: "x".repeat(65537),
            isEditable: false,
            mediaType: "none",
            linkURL: "",
          },
        );
        const item = globalThis.shelfFixture.contextMenu?.items.find(
          (item) => item.label === "Lưu đoạn chọn vào Khay",
        );
        if (!item) return false;
        item.click();
        return true;
      });
      assert.equal(
        fired,
        true,
        "invoke production native context-menu callback",
      );
      await eventually(
        "rejected context selection has visible feedback",
        () =>
          client.evaluate(() =>
            globalThis.shelfFixture.messageBoxes.some((box) =>
              /64 KiB/.test(box.detail || box.message),
            ),
          ),
        2000,
      );
      assert.deepEqual((await list()).items, before.items);
      assert.equal((await state()).shelf.open, false);
      const boxes = await client.evaluate(
        () => globalThis.shelfFixture.messageBoxes,
      );
      assert.equal(boxes.length, 1);
      assert.equal(boxes[0].message, "Chưa thêm được vào Khay.");
      assert.match(boxes[0].detail, /64 KiB/);
      assert.equal(
        boxes[0].detail.includes("xxx"),
        false,
        "feedback contains no selected content",
      );
    },
  );
  await run(
    "lifecycle quit drains a paused private export before clean exit",
    async () => {
      await stop();
      await rm(join(root, "TinNhanDesktop"), { recursive: true, force: true });
      await launch();
      assert.equal((await privateCommand("setup", { password })).ok, true);
      await writeFile(source, fileBytes);
      await pick([source]);
      const id = (await list()).items[0].id;
      const destination = join(root, "quit-export.bin");
      await writeFile(destination, "PREEXISTING_USER_BYTES");
      await rm(join(root, "quit-observed.json"), { force: true });
      await client.evaluate((_, destination) => {
        globalThis.shelfFixture.savePath = destination;
        globalThis.shelfFixture.pause = {
          kind: "export-write",
          armed: true,
          entered: false,
        };
      }, destination);
      const lockVersion = (await state()).privateSpace.lockVersion;
      await page.evaluate(
        ({ id, lockVersion }) => {
          void window.desktop.shelf({ action: "export", id, lockVersion });
        },
        { id, lockVersion },
      );
      await eventually("private export paused at sync", () =>
        client.evaluate(() => globalThis.shelfFixture.pause.entered),
      );
      assert.equal(
        (await readdir(root)).filter((name) => name.startsWith(".gom-export-"))
          .length,
        1,
      );
      const process = client.process();
      let didExit = false;
      const exited = new Promise((resolve) =>
        process.once("exit", (code, signal) => {
          didExit = true;
          resolve({ code, signal });
        }),
      );
      try {
        await client.evaluate(({ app }) => app.quit()).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 200));
        assert.equal(
          didExit,
          false,
          "quit must remain pending until export cleanup can finish",
        );
        assert.equal(
          await readFile(destination, "utf8"),
          "PREEXISTING_USER_BYTES",
        );
        assert.equal(
          (await readdir(root)).filter((name) =>
            name.startsWith(".gom-export-"),
          ).length,
          1,
        );
      } finally {
        await client
          .evaluate(() => globalThis.shelfFixture.pause?.release?.())
          .catch(() => {});
      }
      assert.deepEqual(
        await Promise.race([
          exited,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(Error("export cleanup did not release quit")),
              15000,
            ).unref(),
          ),
        ]),
        { code: 0, signal: null },
      );
      assert.equal(
        await readFile(destination, "utf8"),
        "PREEXISTING_USER_BYTES",
      );
      assert.equal(
        (await readdir(root)).some((name) => name.startsWith(".gom-export-")),
        false,
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(root, "quit-observed.json"), "utf8")),
        { exports: [] },
        "cleanup must complete before will-quit",
      );
      await client.close().catch(() => {});
      client = undefined;
    },
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${checks.length} shelf acceptance groups, synthetic sessions only`,
  );
} catch (error) {
  console.error(
    "Fixture failure state",
    JSON.stringify(await state().catch(() => null)),
  );
  throw error;
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
