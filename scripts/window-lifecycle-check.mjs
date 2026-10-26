import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const profile = await mkdtemp(join(tmpdir(), "tin-nhan-window-"));
const bootstrap = join(profile, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `const {app,session}=require('electron');
app.setPath('appData',${JSON.stringify(profile)});
require('node:os').homedir=()=>${JSON.stringify(profile)};
const original=session.fromPartition.bind(session);
session.fromPartition=(...args)=>{
  const ses=original(...args);
  if(!ses.__fixture){
    ses.__fixture=true;
    ses.protocol.handle('https',()=>new Response('<html><body>Window lifecycle fixture</body></html>',{headers:{'content-type':'text/html'}}));
  }
  return ses;
};
require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});`,
);
let client;
try {
  client = await _electron.launch({
    executablePath:
      "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    args: [bootstrap],
    timeout: 30000,
  });
  const page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  const before = await client.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return {
      id: win.id,
      views: win.contentView.children.map((v) => v.webContents.id),
    };
  });
  await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  const hidden = await client.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return !!win && !win.isDestroyed() && !win.isVisible();
  });
  assert.equal(
    hidden,
    true,
    "Close must hide the window and keep the app alive",
  );
  await client.evaluate(({ app }) => app.emit("activate"));
  const after = await client.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return {
      id: win.id,
      views: win.contentView.children.map((v) => v.webContents.id),
      visible: win.isVisible(),
    };
  });
  assert.equal(after.visible, true);
  assert.equal(after.id, before.id);
  assert.deepEqual(
    after.views,
    before.views,
    "Reopening must retain service views",
  );
  const exited = new Promise((resolve) =>
    client.process().once("exit", resolve),
  );
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Quit did not exit")), 15000).unref(),
    ),
  ]);
  console.log(
    "PASS close hides, Dock activation restores same views, quit exits",
  );
} finally {
  await client?.close().catch(() => {});
  await rm(profile, { recursive: true, force: true });
}
