import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = await mkdtemp(join(tmpdir(), "tin-nhan-05-"));
const bootstrap = join(root, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `const e=require('electron');e.app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};const original=e.session.fromPartition.bind(e.session);e.session.fromPartition=(...args)=>{const ses=original(...args);if(!ses.fixture){ses.fixture=true;ses.protocol.handle('https',()=>new Response('<html><body style="margin:0;background:#fff;height:100vh"><h1>Chats</h1><button aria-label="New message">New message</button><input id="contact-search-input"><div class="chatlist"><a data-peer-id="1"></a></div><textarea id="draft"></textarea></body></html>',{headers:{'content-type':'text/html'}}));}return ses;};require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});`,
);
let client, page;
const errors = [];
async function launch() {
  client = await _electron.launch({
    executablePath:
      "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    args: [bootstrap],
  });
  page = await client.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.desktop);
}
async function state() {
  return page.evaluate(() => window.desktop.state());
}
async function quit() {
  const exited = new Promise((r) => client.process().once("exit", r));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
  client = null;
}
const out = "../shell-05-check";
async function native() {
  return client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children.map((v) => ({
      id: v.webContents.id,
      visible: v.getVisible(),
      bounds: v.getBounds(),
    })),
  );
}
async function settle() {
  await page.waitForTimeout(160);
}
async function menuCommand() {
  await client.evaluate(({ Menu, BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.contentView.children.find((v) => v.getVisible())?.webContents.focus();
    const item = Menu.getApplicationMenu()
      .items.find((i) => i.label === "Không gian")
      .submenu.items.find((i) => i.label === "Chuyển nhanh…");
    item.click();
  });
}
try {
  await launch();
  await mkdir(out, { recursive: true });
  assert.deepEqual((await state()).presentation, {
    sidebarWidth: 224,
    theme: "platform",
    pinned: [],
  });
  for (const provider of ["zalo", "messenger", "telegram"])
    assert.equal(
      (
        await page.evaluate(
          (p) => window.desktop.addAccount(p, "Công việc " + p, "CV"),
          provider,
        )
      ).ok,
      true,
    );
  await page.evaluate(() => window.desktop.activate("zalo"));
  const originalAccounts = (await state()).accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
  }));
  const originalIds = (await native()).map((v) => v.id);
  await client.evaluate(async ({ BrowserWindow }) => {
    for (const v of BrowserWindow.getAllWindows()[0].contentView.children) {
      await v.webContents.executeJavaScript(
        'document.querySelector("#draft").value="unsent-fixture"',
      );
    }
  });
  await page.locator("#quick-switch").click();
  await page.locator("#command-dialog").waitFor({ state: "visible" });
  assert.equal((await state()).commandOpen, true);
  assert.ok((await native()).every((v) => !v.visible));
  await page.locator("#command-search").fill("telegram ca nhan");
  assert.equal(await page.locator(".command-result").count(), 1);
  await page.keyboard.press("Enter");
  await settle();
  assert.equal((await state()).active, "telegram");
  assert.equal((await state()).commandOpen, false);
  await menuCommand();
  await page.locator("#command-dialog").waitFor({ state: "visible" });
  await page.locator("#command-search").fill("no results at all");
  assert.equal(await page.locator(".command-result").count(), 0);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal((await state()).commandOpen, true);
  await page.locator("#command-search").fill("");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowDown");
  const selected = await page
    .locator(".command-result[aria-selected=true]")
    .getAttribute("id");
  await page.keyboard.press("Enter");
  await settle();
  assert.equal((await state()).active, selected.replace("command-result-", ""));
  await menuCommand();
  await page.locator("#command-dialog").waitFor({ state: "visible" });
  await page.locator(".command-result").first().focus();
  await page.keyboard.press("ArrowDown");
  const selected2 = await page
    .locator(".command-result[aria-selected=true]")
    .getAttribute("id");
  await page.keyboard.press("Enter");
  await settle();
  assert.equal(
    (await state()).active,
    selected2.replace("command-result-", ""),
  );
  for (const theme of ["light", "dark"])
    for (const collapsed of [false, true]) {
      await page.evaluate((t) => window.desktop.setTheme(t), theme);
      if ((await state()).collapsed !== collapsed)
        await page.evaluate(() => window.desktop.toggleSidebar());
      for (const scene of ["service", "command", "accounts"]) {
        if (scene === "accounts")
          await page.evaluate(() => window.desktop.settings());
        else {
          await page.evaluate(() => window.desktop.activate("telegram"));
          if (scene === "command") await menuCommand();
        }
        await settle();
        const geometry = await page.evaluate(() => {
          const aside = document.querySelector("aside").getBoundingClientRect(),
            footer = document
              .querySelector(".sidebar-bottom")
              .getBoundingClientRect();
          return {
            width: aside.width,
            footer: footer.bottom,
            viewport: innerHeight,
            overflow: document.documentElement.scrollWidth > innerWidth,
            theme: document.documentElement.dataset.theme,
          };
        });
        assert.equal(geometry.width, collapsed ? 72 : 224);
        assert.ok(!geometry.overflow);
        assert.ok(geometry.footer <= geometry.viewport);
        assert.equal(geometry.theme, theme);
        assert.equal(
          (await native()).filter((v) => v.visible).length,
          scene === "service" ? 1 : 0,
        );
        await page.screenshot({
          path:
            out +
            "/" +
            scene +
            "-" +
            theme +
            "-" +
            (collapsed ? "collapsed" : "expanded") +
            ".png",
        });
        if (scene === "command") {
          await page.keyboard.press("Escape");
          await settle();
          assert.equal((await state()).commandOpen, false);
          assert.equal((await native()).filter((v) => v.visible).length, 1);
        }
      }
    }
  await page.evaluate(() => window.desktop.settings());
  await page.locator('[data-filter="messenger"]').click();
  assert.equal(
    await page.locator("#account-manager .account-manage-row:visible").count(),
    2,
  );
  await page.locator('[data-filter="all"]').click();
  const pin = page.locator('[data-focus="pin-zalo"]');
  await pin.focus();
  await page.keyboard.press("Enter");
  await settle();
  assert.ok((await state()).presentation.pinned.includes("zalo"));
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.focus),
    "pin-zalo",
  );
  assert.equal(await page.locator(".pinned-group #provider-zalo").count(), 1);
  await page.locator('[data-focus="edit-zalo"]').click();
  await page.locator("#account-name").fill("<img onerror=bad>");
  await page.evaluate(() => window.desktop.setTheme("light"));
  await settle();
  assert.equal(
    await page.locator("#account-name").inputValue(),
    "<img onerror=bad>",
  );
  await page.locator("#account-editor-save").click();
  await settle();
  assert.equal(
    await page.locator("#provider-zalo .provider-label").textContent(),
    "<img onerror=bad>",
  );
  assert.equal(
    await page.locator("#provider-zalo .provider-label img").count(),
    0,
  );
  if ((await state()).collapsed)
    await page.evaluate(() => window.desktop.toggleSidebar());
  await page.locator("#sidebar-resizer").focus();
  await page.keyboard.press("End");
  await settle();
  assert.equal((await state()).presentation.sidebarWidth, 300);
  assert.ok((await native()).every((v) => v.bounds.x === 300));
  await page.keyboard.press("Home");
  await settle();
  assert.equal((await state()).presentation.sidebarWidth, 200);
  const r = await page.locator("#sidebar-resizer").boundingBox();
  await page.mouse.move(r.x + 4, r.y + 80);
  await page.mouse.down();
  await page.mouse.move(276, r.y + 80, { steps: 5 });
  await page.mouse.up();
  await settle();
  assert.equal((await state()).presentation.sidebarWidth, 276);
  assert.ok((await native()).every((v) => v.bounds.x === 276));
  for (const tab of ["appearance", "notifications", "macos", "accounts"]) {
    await page.locator('[data-tab="' + tab + '"]').click();
    assert.equal(await page.locator("#tab-" + tab).isVisible(), true);
  }
  for (const [w, h] of [
    [940, 640],
    [1440, 900],
  ]) {
    await client.evaluate(
      ({ BrowserWindow }, [w, h]) =>
        BrowserWindow.getAllWindows()[0].setContentSize(w, h),
      [w, h],
    );
    await settle();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: out + "/accounts-" + w + ".png" });
  }
  assert.deepEqual(
    (await native()).map((v) => v.id),
    originalIds,
  );
  assert.deepEqual(
    (await state()).accounts.map((a) => ({ id: a.id, provider: a.provider })),
    originalAccounts,
  );
  assert.ok(
    (
      await client.evaluate(async ({ BrowserWindow }) =>
        Promise.all(
          BrowserWindow.getAllWindows()[0].contentView.children.map((v) =>
            v.webContents.executeJavaScript(
              'document.querySelector("#draft").value',
            ),
          ),
        ),
      )
    ).every((v) => v === "unsent-fixture"),
  );
  // Hide and restore palette over settings must return to settings, not expose a provider.
  await menuCommand();
  await page.keyboard.press("Escape");
  await settle();
  assert.equal((await state()).panel, "settings");
  assert.ok((await native()).every((v) => !v.visible));
  await page.evaluate(() => window.desktop.setTheme("dark"));
  await quit();
  const saved = JSON.parse(
    await readFile(join(root, "TinNhanDesktop/window.json"), "utf8"),
  );
  assert.equal(saved.presentation.sidebarWidth, 276);
  assert.equal(saved.presentation.theme, "dark");
  assert.ok(saved.presentation.pinned.includes("zalo"));
  await launch();
  assert.deepEqual((await state()).presentation, saved.presentation);
  assert.deepEqual(
    (await state()).accounts.map((a) => ({ id: a.id, provider: a.provider })),
    originalAccounts,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS 12 variants; native menu/overlay visibility; command search and keyboard; pin/filter/edit focus; escaped names; pointer/key resize; responsive settings; provider IDs/drafts unchanged; presentation and account IDs survive restart; no renderer errors",
  );
} finally {
  if (client) await client.close();
  await rm(root, { recursive: true, force: true });
}
