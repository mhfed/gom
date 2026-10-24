import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import sharp from "sharp";
const output = resolve("../../outputs/TinNhan-0.5-prototype");
const screenshots = resolve("../prototype-0.5-check");
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({
  executablePath: resolve(
    homedir(),
    "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ),
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) external.push(r.url());
});
const entry = pathToFileURL(resolve(output, "index.html")).href;
try {
  await page.goto(entry);
  assert.equal(await page.locator(".account-item").count(), 6);
  assert.equal(
    await page
      .locator(".app-window")
      .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    1216,
  );
  // All12 requested variants, including palette on an actual modal backdrop.
  const shots = [];
  for (const scene of ["chat", "command", "accounts"])
    for (const theme of ["light", "dark"])
      for (const collapsed of [false, true]) {
        await page.keyboard.press("Escape");
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page.locator("#theme-toggle").click();
        if (
          (await page
            .locator("#collapse-toggle")
            .getAttribute("aria-expanded")) !== String(!collapsed)
        )
          await page.locator("#collapse-toggle").click();
        await page.locator(`[data-scene="${scene}"]`).click();
        await page.waitForTimeout(170);
        const geometry = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          sidebar: Math.round(
            document.querySelector(".sidebar").getBoundingClientRect().width,
          ),
          footer: document
            .querySelector(".sidebar-footer")
            .getBoundingClientRect().bottom,
          app: document.querySelector(".app-window").getBoundingClientRect()
            .bottom,
        }));
        assert.equal(geometry.overflow, false);
        assert.equal(geometry.sidebar, collapsed ? 72 : 224);
        assert.ok(geometry.footer <= geometry.app + 1);
        const name = `${scene}-${theme}-${collapsed ? "collapsed" : "expanded"}.png`;
        const path = resolve(screenshots, name);
        await page.screenshot({ path });
        shots.push(path);
      }
  await page.keyboard.press("Escape");
  await page.locator('[data-scene="chat"]').click();
  await page.keyboard.press("Meta+k");
  await page.locator("#command-search").fill("zalo cong viec");
  assert.equal(await page.locator(".command-result").count(), 1);
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#command-dialog").evaluate((e) => e.open),
    false,
  );
  assert.match(await page.locator("#breadcrumb").innerText(), /Zalo/);
  await page.keyboard.press("Meta+k");
  await page.locator("#command-search").fill("khongtimthayzz");
  assert.equal(await page.locator(".command-result").count(), 0);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+k");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.hasAttribute("data-close-command"),
    ),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.locator("#command-search").getAttribute("aria-activedescendant"),
    "command-result-1",
  );
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#breadcrumb").innerText(), /Telegram/);
  await page.keyboard.press("Meta+k");
  await page.locator("#command-result-0").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#breadcrumb").innerText(), /Telegram/);
  await page.locator('[data-account="zalo-work"]').click();
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.account),
    "zalo-work",
  );
  await page.locator("#message-input").fill("Bản nháp mẫu");
  await page.locator('[data-account="telegram-work"]').click();
  assert.equal(await page.locator("#message-input").inputValue(), "");
  await page.locator('[data-account="zalo-work"]').click();
  assert.equal(
    await page.locator("#message-input").inputValue(),
    "Bản nháp mẫu",
  );
  await page.locator("#message-input").fill("<img src=x onerror=window.bad=1>");
  await page.locator("#composer").evaluate((e) => e.requestSubmit());
  assert.equal(await page.evaluate(() => window.bad), undefined);
  assert.match(await page.locator("#messages").innerText(), /<img src=x/);
  await page.locator('[data-scene="accounts"]').click();
  await page.locator('[data-filter="telegram"]').click();
  assert.equal(await page.locator(".account-row").count(), 2);
  await page.locator('[data-pin="telegram-personal"]').focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.pin),
    "telegram-personal",
  );
  await page.locator('[data-notify="telegram-personal"]').focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.notify),
    "telegram-personal",
  );
  assert.equal(
    await page
      .locator('[data-pin="telegram-personal"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.locator('[data-edit="telegram-personal"]').click();
  await page
    .locator("#editor-name")
    .fill("Tài khoản thử rất dài — công việc & riêng");
  await page.locator("#save-account").click();
  assert.match(
    await page.locator("#account-table").innerText(),
    /Tài khoản thử/,
  );
  await page.locator(".settings-heading [data-add]").click();
  await page.locator("#editor-provider").selectOption("telegram");
  await page.locator("#editor-name").fill("Tài khoản mẫu mới");
  await page.locator("#save-account").click();
  assert.equal(await page.locator(".account-item").count(), 7);
  // Geometry at minimum desktop, wide desktop, and narrow preview.
  for (const viewport of [
    { width: 940, height: 640 },
    { width: 1440, height: 960 },
    { width: 620, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: resolve(screenshots, `accounts-${viewport.width}.png`),
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(entry);
  const handle = page.locator("#sidebar-resizer");
  await handle.focus();
  await page.keyboard.press("End");
  assert.equal(await handle.getAttribute("aria-valuenow"), "300");
  await page.keyboard.press("Home");
  assert.equal(await handle.getAttribute("aria-valuenow"), "200");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 2, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 62, box.y + 120);
  await page.mouse.up();
  assert.equal(await handle.getAttribute("aria-valuenow"), "260");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  const thumbs = await Promise.all(
    shots.map((p) => sharp(p).resize(384, 270).toBuffer()),
  );
  await sharp({
    create: { width: 1536, height: 810, channels: 3, background: "#d7dad2" },
  })
    .composite(
      thumbs.map((input, i) => ({
        input,
        left: (i % 4) * 384,
        top: Math.floor(i / 4) * 270,
      })),
    )
    .png()
    .toFile(resolve(screenshots, "contact-sheet.png"));
  await writeFile(
    resolve(screenshots, "result.json"),
    JSON.stringify(
      {
        passed: true,
        variants: 12,
        errors,
        external,
        checks: [
          "keyboard command search/select/empty/Escape",
          "per-account draft retained",
          "safe text rendering",
          "platform filter/pin/edit/add",
          "minimum/wide/narrow layout",
          "pointer/keyboard sidebar resizing",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS12 visual variants; keyboard command/search; account interactions; scoped drafts; text escaping; sidebar resize; responsive layout; no page errors/remote requests.",
  );
} finally {
  await browser.close();
}
