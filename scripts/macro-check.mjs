// Isolated Electron acceptance fixture: synthetic provider pages and temporary profile.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import executablePath from "electron";
const root = await mkdtemp(join(tmpdir(), "gom-macro-"));
const bootstrap = join(root, "bootstrap.cjs");
const entry = process.env.GOM_SMOKE_APP_ASAR
  ? join(process.env.GOM_SMOKE_APP_ASAR, "dist/main.cjs")
  : fileURLToPath(new URL("../dist/main.cjs", import.meta.url));
await writeFile(
  bootstrap,
  `
const e = require('electron');
e.app.setPath('appData', ${JSON.stringify(root)});
require('node:os').homedir = () => ${JSON.stringify(root)};
process.env.LOCALAPPDATA = ${JSON.stringify(root)};
globalThis.fixture = { sessions: new Map(), menu: null };
e.Menu.prototype.popup = function(options) { fixture.menu = {menu:this,options}; };
e.safeStorage.isAsyncEncryptionAvailable=async()=>true;
e.safeStorage.encryptStringAsync=async t=>Buffer.from(t);
e.safeStorage.decryptStringAsync=async b=>({result:b.toString(),shouldReEncrypt:false});
e.shell.openExternal=async()=>{};
e.dialog.showMessageBox=async()=>({response:1});
const from=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{const s=from(...args);if(!fixture.sessions.has(s)){fixture.sessions.set(s,args[0]);s.protocol.handle('https',()=>new Response('<!doctype html><html><body style="margin:0"><button style="position:absolute;left:30px;top:30px;width:200px;height:100px" onclick="window.hits=(window.hits||0)+1">Test target</button><input id="field" style="position:absolute;left:30px;top:150px;width:200px;height:60px"><div id="drag" style="position:absolute;left:260px;top:30px;width:200px;height:100px;background:lightblue"></div><div id="scroll" style="position:absolute;left:260px;top:160px;width:200px;height:100px;overflow:auto"><div style="height:2000px"></div></div><script>window.hits=0;window.drags=0;document.querySelector("#drag").addEventListener("mousedown",()=>window.dragStart=true);document.querySelector("#drag").addEventListener("mousemove",e=>{if(window.dragStart&&e.buttons)window.dragMoved=true});document.addEventListener("mouseup",()=>{if(window.dragMoved)window.drags++;window.dragStart=false;window.dragMoved=false})</script></body></html>',{headers:{'content-type':'text/html'}}));}return s;};
e.app.whenReady().then(()=>{e.screen.getCursorScreenPoint=()=>{const w=e.BrowserWindow.getAllWindows()[0];const b=w.getContentBounds();return {x:b.x+70,y:b.y+52+70};};});
require(${JSON.stringify(entry)});
`,
);
let client;
async function eventually(fn, label) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timeout: " + label);
}
try {
  client = await _electron.launch({ executablePath, args: [bootstrap] });
  let page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  await page.evaluate(() => window.desktop.activate("zalo"));
  await eventually(
    () =>
      client.evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .some(
            (w) =>
              fixture.sessions.get(w.session)?.includes("zalo") &&
              w.getURL().startsWith("https:") &&
              !w.isLoading(),
          ),
      ),
    "provider loaded",
  );
  const chooseMacro = async (index, slot = 1) => {
    await client.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.show();
      w.focus();
    });
    await page.locator("#navigation-menu").click();
    await eventually(() => client.evaluate(() => !!fixture.menu), "menu");
    await client.evaluate(
      (_e, { index, slot }) => {
        const m = fixture.menu;
        const item = m.menu.getMenuItemById(`macro-slot-${slot}`).submenu.items[
          index
        ];
        item.click();
        fixture.menu = null;
        m.options.callback();
      },
      { index, slot },
    );
  };
  const send = async (events) =>
    client.evaluate(({ webContents }, events) => {
      const w = webContents
        .getAllWebContents()
        .find(
          (w) =>
            fixture.sessions.get(w.session)?.includes("zalo") &&
            w.getURL().startsWith("https:"),
        );
      w.focus();
      for (const event of events) w.sendInputEvent(event);
    }, events);
  const shortcut = async () => {
    const focused = await client.evaluate(
      async ({ app, BrowserWindow, webContents }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.show();
        for (let attempt = 0; attempt < 10 && !window.isFocused(); attempt++) {
          app.focus({ steal: true });
          window.focus();
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (!window.isFocused()) return false;
        const page = webContents
          .getAllWebContents()
          .find(
            (contents) =>
              fixture.sessions.get(contents.session)?.includes("zalo") &&
              contents.getURL().startsWith("https:"),
          );
        page.focus();
        const modifiers =
          process.platform === "darwin"
            ? ["meta", "shift"]
            : ["control", "shift"];
        page.sendInputEvent({ type: "keyDown", keyCode: "U", modifiers });
        page.sendInputEvent({ type: "keyUp", keyCode: "U", modifiers });
        return true;
      },
    );
    assert.ok(focused, "main window is focused before sending macro shortcut");
  };
  const snapshot = () =>
    client.evaluate(async ({ webContents }) => {
      const w = webContents
        .getAllWebContents()
        .find(
          (w) =>
            fixture.sessions.get(w.session)?.includes("zalo") &&
            w.getURL().startsWith("https:"),
        );
      return w.executeJavaScript(
        '({hits:window.hits,text:document.querySelector("#field").value})',
      );
    });
  await chooseMacro(0);
  await page.waitForFunction(() =>
    document
      .querySelector("#global-action-feedback")
      ?.textContent.includes("Đang ghi"),
  );
  await send([
    { type: "mouseDown", x: 70, y: 70, button: "left", clickCount: 1 },
    { type: "mouseUp", x: 70, y: 70, button: "left", clickCount: 1 },
  ]);
  await new Promise((r) => setTimeout(r, 300));
  await send([
    { type: "mouseDown", x: 70, y: 170, button: "left", clickCount: 1 },
    { type: "mouseUp", x: 70, y: 170, button: "left", clickCount: 1 },
  ]);
  await send([
    { type: "keyDown", keyCode: "A" },
    { type: "char", keyCode: "a" },
    { type: "keyUp", keyCode: "A" },
  ]);
  await eventually(
    async () => (await snapshot()).text === "a",
    "initial typing",
  );
  await shortcut();
  await page.waitForFunction(() =>
    document
      .querySelector("#global-action-feedback")
      ?.textContent.includes("Đã lưu macro"),
  );
  assert.deepEqual(await snapshot(), { hits: 1, text: "a" });
  await client.close();
  client = await _electron.launch({ executablePath, args: [bootstrap] });
  page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  await page.evaluate(() => window.desktop.activate("zalo"));
  await eventually(
    () =>
      client.evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .some(
            (w) =>
              fixture.sessions.get(w.session)?.includes("zalo") &&
              w.getURL().startsWith("https:") &&
              !w.isLoading(),
          ),
      ),
    "provider after restart",
  );
  await chooseMacro(1);
  await eventually(async () => {
    const s = await snapshot();
    return s.hits === 1 && s.text === "a";
  }, "macro replay after restart");
  await chooseMacro(2);
  await eventually(async () => (await snapshot()).hits >= 2, "repeat started");
  await shortcut();
  const stopped = await snapshot();
  await new Promise((r) => setTimeout(r, 700));
  assert.deepEqual(await snapshot(), stopped, "shortcut stops playback");
  await chooseMacro(2);
  await eventually(
    async () => (await snapshot()).hits > stopped.hits,
    "second repeat started",
  );
  await page.evaluate(() => window.desktop.activate("telegram"));
  const switched = await snapshot();
  await new Promise((r) => setTimeout(r, 700));
  assert.deepEqual(await snapshot(), switched, "switch stops playback");
  await page.evaluate(() => window.desktop.activate("zalo"));
  await chooseMacro(0, 2);
  await page.waitForFunction(() =>
    document
      .querySelector("#global-action-feedback")
      ?.textContent.includes("Đang ghi"),
  );
  await send([
    { type: "mouseDown", x: 290, y: 70, button: "left", clickCount: 1 },
  ]);
  await new Promise((r) => setTimeout(r, 40));
  await send([
    { type: "mouseMove", x: 350, y: 80, modifiers: ["leftbuttondown"] },
  ]);
  await new Promise((r) => setTimeout(r, 40));
  await send([
    { type: "mouseUp", x: 350, y: 80, button: "left", clickCount: 1 },
  ]);
  await send([
    {
      type: "mouseWheel",
      x: 300,
      y: 190,
      deltaY: -250,
      deltaX: 0,
      canScroll: true,
    },
  ]);
  await new Promise((r) => setTimeout(r, 400));
  await shortcut();
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector("#global-action-feedback")
          ?.textContent.includes("Đã lưu macro"),
      null,
      { timeout: 5000 },
    );
  } catch (e) {
    console.log(
      "save diagnostic",
      await page.locator("#global-action-feedback").textContent(),
      await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isFocused(),
      ),
    );
    throw e;
  }
  const dragState = () =>
    client.evaluate(async ({ webContents }) => {
      const w = webContents
        .getAllWebContents()
        .find(
          (w) =>
            fixture.sessions.get(w.session)?.includes("zalo") &&
            w.getURL().startsWith("https:"),
        );
      return w.executeJavaScript(
        '({drags:window.drags, scroll:document.querySelector("#scroll").scrollTop})',
      );
    });
  const first = await dragState();
  assert.equal(first.drags, 1, "original drag");
  assert.ok(first.scroll > 0, "original scroll");
  const dir = await client.evaluate(({ app }) => app.getPath("userData"));
  const saved = JSON.parse(
    Buffer.from(
      await readFile(join(dir, "macros", "normal-2.json"), "utf8"),
      "base64",
    ).toString(),
  );
  assert.ok(saved.steps.some((step) => step.event.type === "mouseWheel"));
  await chooseMacro(1, 2);
  await eventually(async () => {
    const now = await dragState();
    return now.drags === 2 && now.scroll > first.scroll;
  }, "drag and scroll replay");
  await chooseMacro(6, 2);
  await eventually(async () => {
    try {
      await readFile(join(dir, "macros", "normal-2.json"));
      return false;
    } catch (e) {
      return e.code === "ENOENT";
    }
  }, "slot deletion");
  assert.ok(
    await readFile(join(dir, "macros", "normal.json")),
    "other slot remains",
  );
  await chooseMacro(4, 1);
  await page.locator("#macro-editor-dialog").waitFor({ state: "visible" });
  await page.locator("#macro-repeat").fill("7");
  await page.locator("#macro-delay-0").fill("300");
  await page.locator("#macro-delay-1").fill("800");
  await page.locator("#macro-editor-save").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#macro-editor-error")
      ?.textContent.includes("Đã lưu"),
  );
  await page.locator("#macro-editor-close").click();
  await page.locator("#macro-editor-dialog").waitFor({ state: "hidden" });
  await chooseMacro(4, 1);
  await page.locator("#macro-editor-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#macro-repeat").inputValue(), "7");
  assert.equal(await page.locator("#macro-delay-0").inputValue(), "300");
  assert.equal(await page.locator("#macro-delay-1").inputValue(), "800");
  await page.locator("#macro-editor-play").click();
  await page.locator("#macro-editor-dialog").waitFor({ state: "hidden" });
  await page.locator("#automation-stop").waitFor({ state: "visible" });
  await page.locator("#automation-stop").click();
  await page.locator("#automation-stop").waitFor({ state: "hidden" });
  const afterStop = await snapshot();
  await new Promise((r) => setTimeout(r, 1000));
  assert.deepEqual(
    await snapshot(),
    afterStop,
    "emergency stop cancels custom playback",
  );
  console.log(
    "PASS macro records, edits and persists per-step delays and repeats; plays and emergency-stops; drag and scroll work",
  );
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
