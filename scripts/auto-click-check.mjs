// Isolated Electron acceptance fixture: synthetic provider pages and temporary profile.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import executablePath from "electron";
const root = await mkdtemp(join(tmpdir(), "gom-auto-click-"));
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
const from=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{const s=from(...args);if(!fixture.sessions.has(s)){fixture.sessions.set(s,args[0]);s.protocol.handle('https',()=>new Response('<!doctype html><html><body style="margin:0"><button style="position:absolute;left:30px;top:30px;width:200px;height:100px" onclick="window.hits=(window.hits||0)+1">Test target</button><script>window.hits=0</script></body></html>',{headers:{'content-type':'text/html'}}));}return s;};
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
  const page = await client.firstWindow();
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
  await page.locator("#navigation-menu").click();
  await eventually(() => client.evaluate(() => !!fixture.menu), "menu");
  await client.evaluate(() => {
    const m = fixture.menu;
    const item = m.menu.getMenuItemById("header-auto-click");
    item.submenu.items[0].click();
    fixture.menu = null;
    m.options.callback();
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#global-action-feedback")
      ?.textContent.includes("Đưa chuột"),
  );
  await client.evaluate(({ app, BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    app.focus({ steal: true });
    w.focus();
  });
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
        page.sendInputEvent({ type: "keyDown", keyCode: "Y", modifiers });
        page.sendInputEvent({ type: "keyUp", keyCode: "Y", modifiers });
        return true;
      },
    );
    assert.ok(
      focused,
      "main window is focused before sending auto-click shortcut",
    );
  };
  const hits = () =>
    client.evaluate(async ({ webContents }) => {
      const w = webContents
        .getAllWebContents()
        .find(
          (w) =>
            fixture.sessions.get(w.session)?.includes("zalo") &&
            w.getURL().startsWith("https:"),
        );
      return w.executeJavaScript("window.hits");
    });
  await shortcut();
  try {
    await eventually(async () => (await hits()) >= 2, "clicks delivered");
  } catch (error) {
    console.log(
      "Auto Click diagnostic",
      await page.locator("#global-action-feedback").textContent(),
      await client.evaluate(({ BrowserWindow }) => ({
        focused: BrowserWindow.getAllWindows()[0].isFocused(),
        visible: BrowserWindow.getAllWindows()[0].isVisible(),
      })),
    );
    throw error;
  }
  await page.locator("#automation-stop").waitFor({ state: "visible" });
  await page.locator("#automation-stop").click();
  await page.locator("#automation-stop").waitFor({ state: "hidden" });
  const stopped = await hits();
  await new Promise((r) => setTimeout(r, 750));
  assert.equal(await hits(), stopped, "emergency button stops further clicks");
  await shortcut();
  await eventually(async () => (await hits()) > stopped, "restart");
  await page.evaluate(() => window.desktop.activate("telegram"));
  const switched = await hits();
  await new Promise((r) => setTimeout(r, 750));
  assert.equal(await hits(), switched, "switching account stops clicks");
  console.log(
    "PASS Auto Click delivers real clicks, stops by button and on account switch",
  );
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
