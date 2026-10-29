// Renderer-only fixture. Synthetic main-process boundary, no profile, providers or network.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath:
    process.env.TIN_NHAN_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    bypassCSP: true,
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(await readFile("src/renderer/index.html", "utf8"));
  await page.addStyleTag({
    content: await readFile("src/renderer/shell.css", "utf8"),
  });
  assert.equal(
    await page.locator("#shelf-toggle").count(),
    1,
    "Khay must be accessible from the toolbar",
  );
  const bundle = await build({
    stdin: {
      contents:
        'import {createShelfUI} from "./src/renderer/shelf.ts"; window.makeShelf = createShelfUI;',
      resolveDir: process.cwd(),
    },
    write: false,
    bundle: true,
    format: "iife",
    platform: "browser",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    window.calls = [];
    window.items = [
      {
        id: "text",
        kind: "text",
        createdAt: 3,
        pinned: false,
        name: "Nội dung",
        text: "Dòng đầu\nDòng hai\tgiữ nguyên <img src=x onerror=alert(1)>",
        bytes: 85,
        mime: "text/plain",
      },
      {
        id: "file",
        kind: "file",
        createdAt: 2,
        pinned: true,
        name: "<img onerror=alert(1)> báo giá dài ".repeat(5) + ".pdf",
        bytes: 2048,
        mime: "application/pdf",
      },
      {
        id: "image",
        kind: "image",
        createdAt: 1,
        pinned: false,
        name: "Ảnh sản phẩm.png",
        bytes: 1000,
        mime: "image/png",
      },
      {
        id: "link",
        kind: "link",
        createdAt: 0,
        pinned: false,
        name: "Liên kết",
        text: "https://example.com/san-pham",
        bytes: 30,
        mime: "text/plain",
      },
    ];
    window.state = {
      privateSpace: { unlocked: false, lockVersion: 0 },
      shelf: {
        open: false,
        count: 4,
        totalBytes: 3163,
        revision: 1,
        unavailable: false,
      },
    };
    window.snapshot = () => ({
      items: structuredClone(window.items),
      totalBytes: 3163,
      revision: window.state.shelf.revision,
      unavailable: false,
      error: "",
    });
    window.emit = () => window.ui.render(structuredClone(window.state));
    window.request = async (request) => {
      window.calls.push(request);
      if (window.holdAction === request.action)
        return new Promise((resolve) => (window.finish = resolve));
      if (request.action === "surface") {
        window.state.shelf.open = request.open;
        window.emit();
        return { ok: true };
      }
      if (request.action === "preview")
        return {
          ok: true,
          dataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        };
      if (request.action === "pin")
        window.items.find((i) => i.id === request.id).pinned = request.pinned;
      if (request.action === "remove")
        window.items = window.items.filter((i) => i.id !== request.id);
      if (request.action === "clear")
        window.items = window.items.filter((i) => i.pinned);
      if (request.action === "add-text")
        window.items.unshift({
          id: "added",
          kind: "text",
          createdAt: 5,
          pinned: false,
          name: "Văn bản",
          text: request.text,
          bytes: 4,
          mime: "text/plain",
        });
      if (
        [
          "pin",
          "remove",
          "clear",
          "add-text",
          "clipboard",
          "pick-files",
        ].includes(request.action)
      ) {
        window.state.shelf.revision++;
        window.state.shelf.count = window.items.length;
      }
      if (
        [
          "pin",
          "remove",
          "clear",
          "add-text",
          "clipboard",
          "pick-files",
        ].includes(request.action)
      )
        window.emit();
      return { ok: true, snapshot: window.snapshot() };
    };
    window.ui = window.makeShelf({
      getState: () => window.state,
      request: window.request,
    });
    window.emit();
  });
  const idleMutationCount = () =>
    page.evaluate(() => {
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      for (let poll = 0; poll < 5; poll++) window.emit();
      const count = observer.takeRecords().length;
      observer.disconnect();
      return count;
    });
  const closedIdleMutations = await idleMutationCount();
  await page.locator("#shelf-toggle").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shelf-card").length === 4,
  );
  assert.equal(await page.locator("#shelf-panel").isVisible(), true);
  const openIdleMutations = await idleMutationCount();
  assert.deepEqual(
    { closed: closedIdleMutations, open: openIdleMutations },
    { closed: 0, open: 0 },
    "five identical closed and loaded-open snapshots must produce zero DOM mutations",
  );

  assert.equal(
    await page.locator("#shelf-list img[onerror]").count(),
    0,
    "hostile names must stay inert text",
  );
  assert.equal(
    await page.locator(".shelf-card").first().getAttribute("data-shelf-id"),
    "file",
  );
  await page
    .locator('[data-shelf-id="text"] [data-shelf-action="copy"]')
    .click();
  assert.match(await page.locator("#shelf-status").innerText(), /Đã sao chép/);
  await page
    .locator('[data-shelf-id="file"] [data-shelf-action="export"]')
    .click();
  assert.ok(
    await page.evaluate(() =>
      window.calls.some(
        (c) => c.action === "export" && c.id === "file" && c.lockVersion === 0,
      ),
    ),
  );
  await page.locator("#shelf-search").fill("Dòng hai");
  assert.equal(await page.locator(".shelf-card").count(), 1);
  await page.locator("#shelf-search").fill("");
  await page.evaluate(() => {
    window.card = document.querySelector('[data-shelf-id="text"]');
    window.card.querySelector("button").focus();
    window.emit();
  });
  assert.equal(
    await page.evaluate(
      () =>
        window.card === document.querySelector('[data-shelf-id="text"]') &&
        window.card.contains(document.activeElement),
    ),
    true,
    "unrelated polls preserve the card and focus",
  );
  await page.locator('[data-shelf-filter="image"]').click();
  assert.equal(await page.locator(".shelf-card").count(), 1);
  await page.waitForFunction(
    () =>
      !!document
        .querySelector(".shelf-card img")
        ?.src.startsWith("data:image/png"),
  );
  await page.locator('[data-shelf-filter="all"]').click();
  await page
    .locator('[data-shelf-id="text"] [data-shelf-action="pin"]')
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-shelf-id="text"] [data-shelf-action="pin"]')
        .getAttribute("aria-pressed") === "true",
  );
  assert.equal(
    await page.evaluate(
      () => document.activeElement?.closest("[data-shelf-id]")?.dataset.shelfId,
    ),
    "text",
    "pinning preserves keyboard focus on the updated card",
  );
  await page.locator("#shelf-clear").click();
  assert.equal(await page.locator("#shelf-clear-confirm").isVisible(), true);
  assert.match(await page.locator("#shelf-clear-confirm").innerText(), /2/);
  await page.locator("#shelf-clear-cancel").click();
  assert.equal(await page.locator(".shelf-card").count(), 4);
  await page.locator("#shelf-clear").click();
  await page.locator("#shelf-clear-accept").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shelf-card").length === 2,
  );
  await page.locator("#shelf-text").fill("Bản nháp\nxuống dòng");
  await page.locator("#shelf-add-text").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shelf-card").length === 3,
  );
  assert.equal(await page.locator("#shelf-text").inputValue(), "");
  await page
    .locator('[data-shelf-id="added"] [data-shelf-action="remove"]')
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shelf-card").length === 2,
  );
  const out = "outputs/shelf-ui-check";
  await mkdir(out, { recursive: true });
  for (const width of [1280, 940, 400])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const rect = await page.locator("#shelf-panel").boundingBox();
      assert.equal(rect.y, 52);
      assert.equal(rect.width, width < 940 ? width : 340);
      assert.equal(rect.x + rect.width, width);
      assert.equal(
        await page
          .locator("#shelf-panel")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
        false,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.screenshot({ path: `${out}/${theme}-${width}.png` });
    }
  const importReport = Array.from({ length: 10 }, (_, index) => {
    const name = `bao-gia-${String(index + 1).padStart(2, "0")}-${"a".repeat(145)}.pdf`;
    assert.equal(new TextEncoder().encode(name).byteLength, 160);
    return `${name} — Lý do ${index + 1}: Tệp vượt quá 50 MB.`;
  }).join("\n");
  await page.evaluate(() => (window.holdAction = "pick-files"));
  await page.locator("#shelf-pick-files").click();
  await page.evaluate(
    (message) => window.finish({ ok: false, message }),
    importReport,
  );
  await page.waitForFunction(() =>
    document.querySelector("#shelf-status").textContent.includes("Lý do 10:"),
  );
  const reportLayouts = [];
  for (const width of [400, 940]) {
    await page.setViewportSize({ width, height: 640 });
    const layout = await page.evaluate(() => {
      const status = document.querySelector("#shelf-status");
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height };
      };
      return {
        status: rect(status),
        scrollHeight: status.scrollHeight,
        clientHeight: status.clientHeight,
        overflow: getComputedStyle(status).overflowY,
        tabIndex: status.tabIndex,
        footer: rect(document.querySelector(".shelf-footer")),
        close: rect(document.querySelector("#shelf-close")),
      };
    });
    reportLayouts.push({ width, ...layout });
  }
  assert.ok(
    reportLayouts.every(
      (layout) =>
        layout.status.height <= 120 &&
        layout.scrollHeight > layout.clientHeight &&
        ["auto", "scroll"].includes(layout.overflow),
    ),
    `ten import failures must stay within a scrollable status: ${JSON.stringify(reportLayouts)}`,
  );
  assert.equal(
    await page.locator("#shelf-status").textContent(),
    importReport,
    "every filename and failure reason remains available",
  );
  for (const layout of reportLayouts) {
    assert.equal(
      layout.tabIndex,
      0,
      "nonempty import report is keyboard reachable",
    );
    assert.ok(
      layout.footer.bottom <= 640 &&
        layout.close.top >= 52 &&
        layout.close.bottom <= 640,
      "footer and close remain in the viewport",
    );
  }
  for (const width of [400, 940]) {
    await page.setViewportSize({ width, height: 640 });
    await page
      .locator("#shelf-status")
      .evaluate((status) => (status.scrollTop = 0));
    await page.locator("#shelf-status").focus();
    await page.keyboard.press("PageDown");
    await page.waitForFunction(
      () => document.querySelector("#shelf-status").scrollTop > 0,
    );
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const status = document.querySelector("#shelf-status");
      return status.scrollTop + status.clientHeight >= status.scrollHeight - 1;
    });
    await page.screenshot({ path: `${out}/import-report-${width}.png` });
  }
  await page.evaluate(() => {
    window.holdAction = "clipboard";
  });
  await page.locator("#shelf-from-clipboard").click();
  await page.evaluate(() => {
    window.state.privateSpace = { unlocked: true, lockVersion: 1 };
    window.state.shelf = {
      open: false,
      count: 0,
      totalBytes: 0,
      revision: 0,
      unavailable: false,
    };
    window.emit();
    window.finish({ ok: false, message: "OLD_PRIVATE_RESULT" });
  });
  assert.equal(await page.locator("#shelf-panel").isVisible(), false);
  assert.equal(await page.locator("#shelf-list").textContent(), "");
  assert.equal(await page.locator("#shelf-search").inputValue(), "");
  assert.equal(await page.locator("#shelf-text").inputValue(), "");
  assert.equal(await page.locator("#shelf-status").textContent(), "");
  await page.evaluate(() => {
    window.holdAction = "";
    window.items = [];
    window.state.shelf.open = true;
    window.emit();
  });
  await page.waitForFunction(() =>
    document.querySelector("#shelf-list").textContent.includes("Chưa có"),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.state.shelf.open);
  await page.evaluate(() => {
    window.state.shelf.open = true;
    window.state.shelf.unavailable = true;
    window.state.shelf.revision++;
    window.holdAction = "list";
    window.emit();
  });
  await page.evaluate(() =>
    window.finish({ ok: false, message: "Không đọc được khay." }),
  );
  await page.waitForFunction(() =>
    document
      .querySelector("#shelf-status")
      .textContent.includes("Không đọc được"),
  );
  assert.equal(await page.locator("#shelf-retry").isVisible(), true);
  assert.equal(
    await page.locator("#shelf-list").innerText(),
    "",
    "an unreadable store must not masquerade as an empty shelf",
  );
  assert.equal(await page.locator("#shelf-from-clipboard").isDisabled(), true);
  await page.evaluate(() => {
    window.holdAction = "";
    window.items = Array.from({ length: 100 }, (_, index) => ({
      id: `quota-${index}`,
      kind: "text",
      createdAt: index,
      pinned: false,
      name: "Văn bản",
      text: "Nội dung",
      bytes: 10,
      mime: "text/plain",
    }));
    window.state.shelf.unavailable = false;
    window.state.shelf.revision++;
    window.state.shelf.count = 100;
    window.emit();
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".shelf-card").length === 100,
  );
  assert.equal(await page.locator("#shelf-quota").isVisible(), true);
  assert.equal(await page.locator("#shelf-pick-files").isDisabled(), true);
  assert.equal(
    await page
      .locator('.shelf-card [data-shelf-action="remove"]')
      .first()
      .isDisabled(),
    false,
  );
  await page.evaluate(() => window.ui.conceal());
  assert.equal(await page.locator("#shelf-panel").isVisible(), false);
  assert.equal(await page.locator("#shelf-list").textContent(), "");
  assert.equal(
    await page.evaluate(() => window.calls.at(-1).action),
    "surface",
  );
  assert.equal(await page.evaluate(() => window.calls.at(-1).lockVersion), 1);
  // Exercise the shell consumer too: its welcome cards exist even behind a native page.
  const shell = await browser.newPage({
    bypassCSP: true,
    viewport: { width: 1280, height: 800 },
  });
  shell.on("pageerror", (error) => errors.push(error.message));
  await shell.setContent(await readFile("src/renderer/index.html", "utf8"));
  await shell.addStyleTag({
    content: await readFile("src/renderer/shell.css", "utf8"),
  });
  await shell.evaluate(() => {
    const accounts = Array.from({ length: 9 }, (_, index) => ({
      id: `account-${index}`,
      provider: "zalo",
      name: `Tài khoản ${index}`,
      avatar: "A",
      archived: false,
    }));
    const record = (value) =>
      Object.fromEntries(accounts.map((a) => [a.id, structuredClone(value)]));
    window.fixture = {
      accounts,
      providers: [
        {
          id: "zalo",
          label: "Zalo",
          entry: "https://chat.zalo.me",
          custom: false,
          hosts: ["chat.zalo.me"],
          color: "#067",
        },
      ],
      providerTabs: { open: ["zalo"], pinned: [] },
      presentation: { sidebarWidth: 224, theme: "light", pinned: [] },
      commandOpen: false,
      accountBusy: false,
      catalogWarning: "",
      preferences: {
        paused: false,
        shortcut: false,
        updateChecks: false,
        notifications: record("ask"),
      },
      connections: record({ phase: "connected", reason: null, retryAt: null }),
      canGoBack: false,
      openAtLogin: false,
      startupAvailable: false,
      notificationStatus: "",
      themes: record(null),
      collapsed: false,
      unread: record({
        count: 0,
        kind: "messages",
        approximate: false,
        source: "platform",
      }),
      active: "account-0",
      panel: "service",
      statuses: record("authenticated"),
      profiles: [],
      importing: false,
      notice: "",
      version: "fixture",
      privateSpace: {
        configured: false,
        unlocked: false,
        unavailable: false,
        lockVersion: 0,
        retryAt: 0,
      },
      shelf: {
        open: false,
        count: 0,
        totalBytes: 0,
        revision: 0,
        unavailable: false,
      },
      updates: {
        phase: "idle",
        currentVersion: "fixture",
        latestVersion: null,
        releaseUrl: null,
        releaseNotes: "",
        downloadProgress: null,
        checkedAt: null,
        message: "",
      },
    };
    window.desktop = new Proxy(
      {
        state: async () => structuredClone(window.fixture),
        changed: (callback) =>
          (window.emit = () => callback(structuredClone(window.fixture))),
        getProviderLogo: async () => null,
      },
      { get: (object, key) => object[key] || (() => Promise.resolve()) },
    );
  });
  const shellBundle = await build({
    entryPoints: ["src/renderer/shell.ts"],
    write: false,
    bundle: true,
    format: "iife",
    platform: "browser",
  });
  await shell.addScriptTag({ content: shellBundle.outputFiles[0].text });
  await shell.waitForFunction(
    () => document.querySelectorAll(".welcome-account").length === 8,
  );
  const shellIdleMutations = await shell.evaluate(() => {
    window.firstWelcomeCard = document.querySelector(".welcome-account");
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    for (let poll = 0; poll < 5; poll++) window.emit();
    const records = observer.takeRecords();
    observer.disconnect();
    return records.map((record) => ({
      id: record.target.id,
      attribute: record.attributeName,
      type: record.type,
    }));
  });
  assert.deepEqual(
    shellIdleMutations,
    [],
    "the full shell must not mutate for five identical snapshots",
  );
  await shell.evaluate(() => {
    window.fixture.accounts[0].name = "Tên đã đổi";
    window.fixture.unread["account-0"].count = 7;
    window.emit();
  });
  assert.equal(
    await shell
      .locator(".welcome-account")
      .first()
      .locator(".welcome-account-name")
      .innerText(),
    "Tên đã đổi",
  );
  assert.equal(
    await shell
      .locator(".welcome-account")
      .first()
      .locator(".welcome-unread")
      .innerText(),
    "7",
  );
  await shell.evaluate(() => {
    window.fixture.providers[0].label = "Tên nền tảng";
    window.fixture.providers[0].logo = {
      kind: "builtin",
      providerId: "telegram",
    };
    window.emit();
  });
  assert.equal(
    await shell
      .locator(".welcome-account")
      .first()
      .locator(".welcome-account-provider")
      .innerText(),
    "Tên nền tảng",
  );
  assert.match(
    await shell
      .locator(".welcome-account")
      .first()
      .locator("img")
      .getAttribute("src"),
    /telegram/,
  );
  await shell.evaluate(() => {
    window.firstWelcomeCard = document.querySelector(".welcome-account");
    window.fixture.privateSpace.unlocked = true;
    window.fixture.privateSpace.lockVersion++;
    window.emit();
  });
  assert.equal(
    await shell.evaluate(() => window.firstWelcomeCard.isConnected),
    false,
  );
  await shell.evaluate(() => {
    window.fixture.accounts = [];
    window.fixture.active = "";
    window.fixture.providerTabs.open = [];
    window.emit();
  });
  assert.equal(await shell.locator(".welcome-account").count(), 0);
  assert.equal(
    await shell.locator("#welcome-account-count").innerText(),
    "0 tài khoản",
  );
  assert.equal(
    await shell.locator("#welcome-empty").evaluate((e) => e.hidden),
    false,
  );
  await shell.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS shelf UI: open, stable polls/focus, inert text, search/filter, image preview, pin/delete/clear confirmation, multiline add, copy/export, epoch scrub, keyboard, 1280/940/400 light/dark, full-shell idle0 and live welcome updates, ten-file report keyboard scroll at400/940×640",
  );
} finally {
  await browser.close();
}
