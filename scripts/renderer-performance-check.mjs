import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright-core";

// Exercise the production renderer against a synthetic IPC boundary in an
// isolated browser profile. No provider pages or personal sessions are loaded.
const source = fileURLToPath(new URL("../src/renderer/", import.meta.url));
const bundle = await build({
  entryPoints: [source + "shell.ts"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
});
const browser = await chromium.launch({
  executablePath: process.env.TIN_NHAN_CHROMIUM,
  headless: true,
});
try {
  const page = await browser.newPage({ bypassCSP: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(await readFile(source + "index.html", "utf8"));
  await page.evaluate(() => {
    const accounts = ["zalo", "messenger", "telegram"].map((id) => ({
      id,
      provider: id,
      name: "Cá nhân",
      avatar: id[0].toUpperCase(),
      archived: false,
    }));
    const record = (value) =>
      Object.fromEntries(
        accounts.map(({ id }) => [id, structuredClone(value)]),
      );
    window.fixture = {
      presentation: { sidebarWidth: 224, theme: "light", pinned: [] },
      commandOpen: false,
      accounts,
      accountBusy: false,
      catalogWarning: "",
      preferences: {
        paused: false,
        shortcut: true,
        notifications: record("ask"),
      },
      connections: record({ phase: "connected", reason: null, retryAt: null }),
      canGoBack: false,
      openAtLogin: false,
      startupAvailable: false,
      notificationStatus: "Fixture",
      themes: record(null),
      collapsed: false,
      unread: record({
        count: 0,
        kind: "messages",
        approximate: false,
        source: "platform",
      }),
      active: "zalo",
      panel: "service",
      statuses: record("authenticated"),
      profiles: [],
      importing: false,
      notice: "",
      version: "fixture",
    };
    window.desktop = {
      state: async () => structuredClone(window.fixture),
      changed: (callback) => {
        window.sendState = () => callback(structuredClone(window.fixture));
      },
      commandRequested: () => {},
      commandClosed: async () => {},
      accountMenu: async () => {},
    };
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(
    () =>
      document.querySelector('#platform-zalo[aria-selected="true"]') &&
      document.querySelector("#account-select")?.value === "zalo" &&
      typeof window.sendState === "function",
  );
  for (const provider of ["zalo", "telegram", "messenger"]) {
    assert.equal(
      await page.locator("#platform-" + provider).getAttribute("role"),
      "tab",
    );
    assert.equal(
      await page.locator("#platform-" + provider).getAttribute("aria-selected"),
      String(provider === "zalo"),
    );
  }
  assert.equal(
    await page.locator("#account-select").evaluate((node) => node.tagName),
    "BUTTON",
  );
  assert.equal(
    await page
      .locator("#platform-messenger .platform-unread")
      .evaluate((node) => node.hidden),
    true,
  );
  const unchanged = await page.evaluate(async () => {
    const mutations = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const icon = document.querySelector("#theme-toggle svg");
    window.sendState();
    await Promise.resolve();
    observer.disconnect();
    return {
      mutations: mutations.length,
      sameThemeIcon: icon === document.querySelector("#theme-toggle svg"),
    };
  });
  assert.deepEqual(unchanged, { mutations: 0, sameThemeIcon: true });

  const changed = await page.evaluate(async () => {
    const unchangedTab = document.querySelector("#platform-telegram");
    const mutations = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(unchangedTab, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    window.fixture.unread.messenger = {
      count: 4,
      kind: "conversations",
      approximate: true,
      source: "loaded",
    };
    window.fixture.statuses.messenger = "needs-login";
    window.fixture.active = "messenger";
    window.fixture.preferences.notifications.messenger = "allow";
    window.fixture.preferences.paused = true;
    window.fixture.presentation.theme = "dark";
    window.sendState();
    await Promise.resolve();
    observer.disconnect();
    return {
      unrelatedTabMutations: mutations.length,
      unreadHidden: document.querySelector(
        "#platform-messenger .platform-unread",
      ).hidden,
      title: document.querySelector("#platform-messenger").title,
      selected: document
        .querySelector("#platform-messenger")
        .getAttribute("aria-selected"),
      account: document.querySelector("#account-select").value,
      dot: document.querySelector("#active-account-status").className,
      theme: document.documentElement.dataset.theme,
      icon: document.querySelector("#theme-toggle use").getAttribute("href"),
    };
  });
  assert.equal(changed.unrelatedTabMutations, 0);
  assert.equal(changed.unreadHidden, false);
  assert.match(changed.title, /Có tin chưa đọc/);
  assert.equal(changed.selected, "true");
  assert.equal(changed.account, "messenger");
  assert.equal(changed.dot, "account-status dot needs-login");
  assert.equal(changed.theme, "dark");
  assert.equal(changed.icon, "#i-sun");

  const settings = await page.evaluate(() => {
    window.fixture.panel = "settings";
    window.sendState();
    document.querySelector("#account-name").value = "Unsaved account name";
    window.fixture.unread.zalo.count = 2;
    window.sendState();
    return {
      status: document.querySelector("#account-status-messenger").textContent,
      notification: document.querySelector("#notification-messenger").value,
      testDisabled: document.querySelector("#test-messenger").disabled,
      paused: document.querySelector("#pause-notifications").checked,
      theme: document.querySelector("#theme-mode").value,
      draft: document.querySelector("#account-name").value,
    };
  });
  assert.deepEqual(settings, {
    status: "Cần đăng nhập",
    notification: "allow",
    testDisabled: true,
    paused: true,
    theme: "dark",
    draft: "Unsaved account name",
  });

  await page.evaluate(() => {
    window.fixture.commandOpen = true;
    window.sendState();
  });
  assert.equal(
    await page.locator('[role="option"][aria-selected="true"]').count(),
    1,
  );
  const repeatedPointer = await page.evaluate(async () => {
    const mutations = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(document.querySelector("#command-results"), {
      subtree: true,
      attributes: true,
    });
    const selected = document.querySelector(
      '[role="option"][aria-selected="true"]',
    );
    let scrolls = 0;
    const scroll = selected.scrollIntoView.bind(selected);
    selected.scrollIntoView = (...args) => {
      scrolls++;
      scroll(...args);
    };
    for (let i = 0; i < 10; i++)
      selected.dispatchEvent(new PointerEvent("pointermove"));
    await Promise.resolve();
    observer.disconnect();
    return { mutations: mutations.length, scrolls };
  });
  assert.deepEqual(repeatedPointer, { mutations: 0, scrolls: 0 });
  await page.locator("#command-search").fill("telegram");
  assert.equal(
    await page
      .locator('[role="option"][aria-selected="true"]')
      .getAttribute("id"),
    "command-result-telegram",
  );
  assert.equal(
    await page.locator("#command-search").getAttribute("aria-activedescendant"),
    "command-result-telegram",
  );
  await page.locator("#command-search").fill("no match");
  assert.equal(
    await page.locator("#command-search").getAttribute("aria-activedescendant"),
    null,
  );
  await page.locator("#command-search").fill("");
  await page.locator("#command-result-zalo").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "command-result-messenger",
  );
  assert.equal(
    await page
      .locator('[role="option"][aria-selected="true"]')
      .getAttribute("id"),
    "command-result-messenger",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS renderer avoids unchanged DOM writes, updates platform tabs/account selection/theme/settings, preserves drafts and command selection",
  );
} finally {
  await browser.close();
}
