import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(
  new URL("../outputs/sidebar-layout-check", import.meta.url),
);
const root = await mkdtemp(join(tmpdir(), "tin-nhan-sidebar-"));
const bootstrap = join(root, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `const {app,session}=require('electron');app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};const original=session.fromPartition.bind(session);session.fromPartition=(...args)=>{const ses=original(...args);if(!ses.__fixture){ses.__fixture=true;ses.protocol.handle('https',()=>new Response('<html><body style="margin:0;height:100vh;background:#17212b">Sidebar fixture</body></html>',{headers:{'content-type':'text/html'}}));}return ses;};require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});`,
);
const client = await _electron.launch({
  executablePath:
    "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  args: [bootstrap],
});
try {
  const page = await client.firstWindow();
  await page.waitForFunction(() => !!window.desktop);
  for (const provider of ["zalo", "messenger", "telegram"]) {
    const result = await page.evaluate(
      (provider) =>
        window.desktop.addAccount(
          provider,
          "Công việc – tên tài khoản dài",
          "💼",
        ),
      provider,
    );
    assert.equal(result.ok, true);
  }
  await page.evaluate(() => window.desktop.settings());
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await mkdir(output, { recursive: true });
  for (const [width, height] of [
    [940, 640],
    [1024, 720],
    [1280, 840],
  ])
    for (const collapsed of [false, true]) {
      await client.evaluate(
        ({ BrowserWindow }, [w, h]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(w, h),
        [width, height],
      );
      if (
        (await page.evaluate(() => window.desktop.state())).collapsed !==
        collapsed
      )
        await page.evaluate(() => window.desktop.toggleSidebar());
      await page.waitForTimeout(180);
      const geometry = await page.evaluate(() => {
        const nav = document.querySelector("#providers"),
          aside = document.querySelector("aside");
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const rows = [...nav.querySelectorAll(".account-button")];
        return {
          aside: rect(aside),
          nav: rect(nav),
          scroll: nav.scrollHeight,
          viewport: nav.clientHeight,
          footer: rect(document.querySelector(".sidebar-bottom")),
          rows: rows.map((e) => ({
            box: rect(e),
            avatar: rect(e.querySelector(".account-avatar")),
            overflow: e.scrollWidth > e.clientWidth,
          })),
        };
      });
      assert.equal(geometry.aside.width, collapsed ? 72 : 224);
      assert.equal(geometry.rows.length, 6);
      assert.ok(
        geometry.rows.every(
          (r) =>
            r.box.height === 44 &&
            !r.overflow &&
            r.avatar.x >= r.box.x &&
            r.avatar.right <= r.box.right,
        ),
      );
      assert.ok(geometry.nav.bottom <= geometry.footer.y + 1);
      assert.ok(
        geometry.footer.bottom <= height,
        JSON.stringify({ width, height, collapsed, ...geometry }),
      );
      if (height >= 720)
        assert.ok(
          geometry.scroll <= geometry.viewport + 1,
          JSON.stringify({ width, height, collapsed, ...geometry }),
        );
      const native = await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.map((v) =>
          v.getBounds(),
        ),
      );
      assert.ok(
        native.every(
          (b) =>
            b.x === (collapsed ? 72 : 224) &&
            b.width === width - b.x &&
            b.y === 76 &&
            b.height === height - 76,
        ),
      );
      if (width === 1024 || width === 940)
        await page.screenshot({
          path: join(
            output,
            `${width}-${collapsed ? "collapsed" : "expanded"}.png`,
          ),
        });
    }
  console.log(
    "PASS sidebar expanded/collapsed at940x640,1024x720,1280x840; six44px rows; long labels contained; fixed footer; six accounts fit at720; native view edges match",
  );
} finally {
  await client.close();
  await rm(root, { recursive: true, force: true });
}
