import { _electron } from "playwright-core";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const root = await mkdtemp(join(tmpdir(), "tinnhan-command-"));
const boot = join(root, "boot.cjs");
await writeFile(
  boot,
  `const e=require('electron');e.app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};
const sessions=new Set(), from=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{const s=from(...args);if(!sessions.has(s)){sessions.add(s);s.protocol.handle('https',()=>new Response('<html><body><textarea id="draft"></textarea></body></html>',{headers:{'content-type':'text/html'}}));}return s;};
require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});`,
);
const client = await _electron.launch({
  executablePath:
    "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  args: ["--use-mock-keychain", boot],
});
try {
  const page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  const menu = () =>
    client.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        .items.find((i) => i.label === "Không gian")
        .submenu.items.find((i) => i.label === "Chuyển nhanh…")
        .click(),
    );
  const focus = () =>
    client.evaluate(({ BrowserWindow }) => {
      const visible =
        BrowserWindow.getAllWindows()[0].contentView.children.filter(
          (v) => v.getVisible() && v.webContents.getURL().startsWith("https:"),
        );
      return visible.length === 1 && visible[0].webContents.isFocused();
    });
  await client.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });
  await page.evaluate(() => window.desktop.activate("telegram"));
  await menu();
  await page.locator("#command-dialog").waitFor({ state: "visible" });
  await page.locator("#command-search").fill("telegram");
  await page.keyboard.press("Enter");
  const deadline = Date.now() + 15000;
  while (!(await focus()) && Date.now() < deadline)
    await page.waitForTimeout(50);
  const restored = await focus();
  await page.evaluate(() => window.desktop.settings());
  await page.locator('[data-focus="edit-zalo"]').click();
  await page.locator("#account-name").fill("Unsaved name");
  await menu();
  await page.waitForTimeout(250);
  const nested = await page.locator("#command-dialog").isVisible();
  const draft = await page.locator("#account-name").inputValue();
  console.log({
    providerFocusRestored: restored,
    commandSuppressedDuringEditor: !nested,
    editorDraftPreserved: draft === "Unsaved name",
  });
  assert.ok(restored && !nested && draft === "Unsaved name");
  console.log(
    "PASS command restores native keyboard focus and never stacks over account editor",
  );
} finally {
  await client.close();
  await rm(root, { recursive: true, force: true });
}
