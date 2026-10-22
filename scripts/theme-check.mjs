import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = await mkdtemp(join(tmpdir(), "tin-nhan-theme-"));
const bootstrap = join(root, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `const {app,session}=require('electron');
app.setPath('appData',${JSON.stringify(root)});
app.whenReady().then(() => {
for (const [id,color] of [['zalo','#ffffff'],['messenger','#18191a'],['telegram','#17212b']]) {
session.fromPartition('persist:'+id).protocol.handle('https', () => new Response('<html><body style="margin:0;background:'+color+';height:100vh;color:gray">Theme fixture</body></html>', {headers:{'content-type':'text/html'}}));
}
});
require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});`,
);
const client = await _electron.launch({
  executablePath:
    "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  args: [bootstrap],
});
try {
  const page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  await mkdir("../theme-check", { recursive: true });
  for (const [id, color, mode] of [
    ["zalo", "#ffffff", "light"],
    ["messenger", "#18191a", "dark"],
    ["telegram", "#17212b", "dark"],
  ]) {
    await page.evaluate((id) => window.desktop.activate(id), id);
    await page.waitForFunction(
      ({ color, mode }) =>
        document.documentElement.style.getPropertyValue("--cream") === color &&
        document.documentElement.dataset.theme === mode,
      { color, mode },
    );
    const colors = await page.evaluate(() =>
      ["aside", "header"].map(
        (s) => getComputedStyle(document.querySelector(s)).backgroundColor,
      ),
    );
    assert.equal(colors[0], colors[1]);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `../theme-check/${id}.png` });
  }
  // Changing a platform's CSS while open must be detected by the existing poll.
  await client.evaluate(async ({ webContents }) => {
    const remote = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("web.telegram.org"));
    await remote.executeJavaScript(
      'document.body.style.backgroundColor="rgb(245,245,245)"',
    );
  });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === "light" &&
      document.documentElement.style.getPropertyValue("--cream") === "#f5f5f5",
  );
  await page.evaluate(() => window.desktop.toggleSidebar());
  await page.waitForTimeout(220);
  await page.screenshot({ path: "../theme-check/collapsed-light.png" });
  console.log(
    "PASS three platform palettes, shared sidebar/header color, runtime theme change and collapsed layout",
  );
} finally {
  await client.close();
  await rm(root, { recursive: true, force: true });
}
