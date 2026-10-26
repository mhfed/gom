// Run after `npm run build`; --baseline records the old UI without asserting
// the redesigned layout. Every account, browser profile and remote page is fake.
import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const project = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(
  await readFile(join(project, "package.json"), "utf8"),
).version;
const output = join(project, "outputs/settings-ui");
const baseline = process.argv.includes("--baseline");
const prefix = baseline ? "before" : "after";
const sections = [
  "accounts",
  "appearance",
  "notifications",
  "macos",
  "updates",
];
const sizes = [
  [940, 640],
  [1024, 720],
  [1440, 900],
];
const results = [];
const errors = [];
const longName = "Phòng chăm sóc khách hàng doanh nghiệp Bắc";
const profileName =
  "Hồ sơ kiểm thử dành cho toàn bộ phòng chăm sóc khách hàng doanh nghiệp và vận hành khu vực";
await access(join(project, "dist/main.cjs"));
const root = await mkdtemp(join(tmpdir(), "tin-nhan-settings-ui-"));
let client;
let page;

const fixtureHTML = `<!doctype html><html data-settings-fixture="true"><body>
<h1>Chats</h1><p>Trang kiểm thử cục bộ · không có tài khoản thật</p><button aria-label="New message">New message</button>
<input id="contact-search-input"><div class="chatlist"><a data-peer-id="fixture"></a></div>
<textarea aria-label="Bản nháp giả"></textarea></body></html>`;

async function check(label, callback) {
  await callback();
  results.push({ label, passed: true });
  console.log(`PASS ${label}`);
}

async function selectSection(section) {
  await page.locator(`[data-tab="${section}"]`).click();
  await page.waitForFunction(
    (id) => !document.getElementById(`tab-${id}`).hidden,
    section,
  );
}

async function setSize(width, height) {
  await client.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setContentSize(...size);
    },
    [width, height],
  );
  await page.waitForFunction(
    ([width, height]) => innerWidth === width && innerHeight === height,
    [width, height],
  );
}

async function setTheme(theme) {
  await page.evaluate((value) => window.desktop.setTheme(value), theme);
  await page.waitForFunction(
    (value) => document.documentElement.dataset.theme === value,
    theme,
  );
}

async function top() {
  await page.evaluate(() => {
    for (const node of document.querySelectorAll(
      "#settings-panel, #settings-panel *",
    ))
      if (node.scrollTop) node.scrollTop = 0;
  });
}

async function openPicker(selector, keyboard = false) {
  const select = page.locator(selector);
  await select.scrollIntoViewIfNeeded();
  if (keyboard) {
    await select.focus();
    await page.keyboard.press("Space");
  } else await select.click();
  await page.waitForFunction(
    (selector) => document.querySelector(selector).matches(":open"),
    selector,
  );
  const snapshot = await select.evaluate((node) => {
    const picker = getComputedStyle(node, "::picker(select)");
    return {
      appearance: getComputedStyle(node).appearance,
      pickerAppearance: picker.appearance,
      pickerBackground: picker.backgroundColor,
      options: [...node.options].map((option) => {
        const rect = option.getBoundingClientRect();
        return {
          text: option.textContent.trim(),
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
      viewport: [innerWidth, innerHeight],
    };
  });
  assert.equal(snapshot.appearance, "base-select");
  assert.equal(snapshot.pickerAppearance, "base-select");
  assert.ok(
    snapshot.options.length,
    `${selector}: picker must contain options`,
  );
  for (const option of snapshot.options) {
    assert.ok(
      option.width > 0 && option.height > 0,
      `${selector}: ${option.text} must render in the open picker`,
    );
    assert.ok(
      option.left >= -1 && option.right <= snapshot.viewport[0] + 1,
      `${selector}: ${option.text} must fit the window horizontally`,
    );
    assert.ok(
      option.top >= -1 && option.bottom <= snapshot.viewport[1] + 1,
      `${selector}: ${option.text} must fit the window vertically`,
    );
  }
  return snapshot;
}

async function closePicker(selector) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (selector) => !document.querySelector(selector).matches(":open"),
    selector,
  );
  assert.ok(
    await page
      .locator(selector)
      .evaluate((node) => document.activeElement === node),
    `${selector}: Escape must restore focus to the select`,
  );
}

async function geometry() {
  return page.evaluate(() => {
    const panel = document.getElementById("settings-panel");
    const active = [...document.querySelectorAll(".settings-pane")].find(
      (node) => !node.hidden,
    );
    const visible = (node) =>
      node.getClientRects().length &&
      getComputedStyle(node).visibility !== "hidden";
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      };
    };
    const controls = [
      ...active.querySelectorAll("button, select, input, summary"),
    ]
      .filter(visible)
      .map((node) => ({
        id:
          node.id || node.getAttribute("aria-label") || node.textContent.trim(),
        ...rect(node),
      }));
    const escapedControls = controls.filter(
      (node) => node.x < -1 || node.right > innerWidth + 1,
    );
    const statuses =
      active.id === "tab-accounts"
        ? [...active.querySelectorAll('[id^="account-status-"]')].map(
            (node) => ({
              id: node.id,
              visible: Boolean(visible(node)),
              text: node.textContent.trim(),
              ...rect(node),
            }),
          )
        : [];
    const containers = [
      document.documentElement,
      document.body,
      panel,
      active,
      ...active.querySelectorAll(
        ".import-controls, .notification-row, .account-manage-row",
      ),
    ]
      .filter(visible)
      .map((node) => ({
        id: node.id || node.className || node.tagName,
        width: node.clientWidth,
        scrollWidth: node.scrollWidth,
      }));
    return {
      viewport: [innerWidth, innerHeight],
      section: active.id,
      controls: controls.length,
      escapedControls,
      statuses,
      overflow: containers.filter((node) => node.scrollWidth > node.width + 1),
    };
  });
}

async function assertGeometry(label) {
  const snapshot = await geometry();
  results.push({ label, ...snapshot });
  if (baseline) return;
  assert.deepEqual(
    snapshot.escapedControls,
    [],
    `${label}: controls must fit the window`,
  );
  assert.deepEqual(snapshot.overflow, [], `${label}: horizontal overflow`);
  for (const status of snapshot.statuses) {
    assert.ok(
      status.visible && status.width > 0 && status.height > 0,
      `${label}: ${status.id} must remain visible`,
    );
    assert.ok(
      status.text,
      `${label}: ${status.id} must show its connection state`,
    );
    assert.ok(
      status.x >= 0 && status.right <= snapshot.viewport[0],
      `${label}: ${status.id} must fit`,
    );
  }
}

try {
  // A snapshot avoids races with another developer rebuilding the real dist.
  await cp(join(project, "dist"), join(root, "dist"), { recursive: true });
  const chrome = join(root, "Library/Application Support/Google/Chrome");
  await mkdir(join(chrome, "Default"), { recursive: true });
  await writeFile(
    join(chrome, "Local State"),
    JSON.stringify({
      profile: {
        info_cache: {
          Default: {
            name: profileName,
            user_name: "fixture-settings-only@example.test",
          },
        },
      },
    }),
  );
  await mkdir(output, { recursive: true });
  const bootstrap = join(root, "bootstrap.cjs");
  await writeFile(
    bootstrap,
    `
const e = require('electron');
const root = ${JSON.stringify(root)};
e.app.setPath('appData', root);
// Running a bootstrap outside package.json otherwise reports Electron's version.
e.app.getVersion = () => ${JSON.stringify(version)};
require('node:os').homedir = () => root;
globalThis.settingsFixture = { sessions: new Set(), external: [], shortcuts: new Set(), login: false };
e.shell.openExternal = async (url) => { settingsFixture.external.push(url); throw Error('External navigation blocked by fixture'); };
e.dialog.showMessageBox = async () => ({ response: 1 });
e.app.getLoginItemSettings = () => ({ openAtLogin: settingsFixture.login });
e.app.setLoginItemSettings = (value) => { settingsFixture.login = value.openAtLogin; };
e.globalShortcut.register = (key) => { settingsFixture.shortcuts.add(key); return true; };
e.globalShortcut.isRegistered = (key) => settingsFixture.shortcuts.has(key);
e.globalShortcut.unregister = (key) => settingsFixture.shortcuts.delete(key);
e.globalShortcut.unregisterAll = () => settingsFixture.shortcuts.clear();
e.Notification.isSupported = () => true;
e.Notification.prototype.show = function() { this.emit('show'); };
e.Notification.prototype.close = function() { this.emit('close'); };
const install = (ses) => {
  if (settingsFixture.sessions.has(ses)) return;
  settingsFixture.sessions.add(ses);
  const response = () => new Response(${JSON.stringify(fixtureHTML)}, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  ses.protocol.handle('https', response);
  ses.protocol.handle('http', response);
};
const fromPartition = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => { const ses = fromPartition(...args); install(ses); return ses; };
e.app.whenReady().then(() => install(e.session.defaultSession));
require(${JSON.stringify(join(root, "dist/main.cjs"))});
`,
  );
  client = await _electron.launch({
    executablePath: join(
      project,
      "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    ),
    args: ["--use-mock-keychain", bootstrap],
    timeout: 20_000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(() => typeof window.desktop?.state === "function");
  await page.evaluate(async () => {
    window.desktop.changed((state) => {
      window.__settingsCheckState = state;
    });
    window.__settingsCheckState = await window.desktop.state();
  });
  await check("isolated app data and synthetic Chrome profile", async () => {
    assert.equal(
      await client.evaluate(({ app }) => app.getPath("userData")),
      join(root, "TinNhanDesktop"),
    );
    const state = await page.evaluate(() => window.desktop.state());
    assert.equal(state.profiles.length, 1);
    assert.equal(state.profiles[0].label, profileName);
  });
  await page.evaluate(async (name) => {
    await window.desktop.setPreference("updateChecks", false);
    for (const id of ["zalo", "messenger", "telegram"])
      await window.desktop.editAccount(id, name, "CS");
    for (const provider of ["zalo", "messenger", "telegram"])
      await window.desktop.addAccount(
        provider,
        "Công việc — đội ngũ hỗ trợ khách hàng dài",
        "CV",
      );
    for (const account of (await window.desktop.state()).accounts)
      await window.desktop.activate(account.id);
    await window.desktop.settings();
  }, longName);
  await page.waitForFunction(() => {
    const state = window.__settingsCheckState;
    return (
      state.panel === "settings" &&
      state.accounts.length === 6 &&
      !state.accountBusy &&
      state.accounts.every(
        (account) => state.statuses[account.id] === "authenticated",
      )
    );
  });
  await page.waitForFunction(
    () => !document.getElementById("add-account-settings").disabled,
  );
  await client.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });

  for (const [width, height] of sizes) {
    await setSize(width, height);
    for (const theme of ["light", "dark"]) {
      await setTheme(theme);
      for (const section of sections) {
        await selectSection(section);
        await top();
        const label = `${theme}-${section}-${width}x${height}`;
        await assertGeometry(label);
        await page.screenshot({
          path: join(output, `${prefix}-${label}.png`),
          animations: "disabled",
        });
      }
      await selectSection("accounts");
      await page.locator(".import-section summary").click();
      await page.locator("#profiles").scrollIntoViewIfNeeded();
      await assertGeometry(`${theme}-import-${width}x${height}`);
      await page.screenshot({
        path: join(output, `${prefix}-${theme}-import-${width}x${height}.png`),
        animations: "disabled",
      });
      await page.locator(".import-section summary").click();
    }
  }
  console.log(
    `${baseline ? "Recorded" : "Verified"} all five sections and import controls at three sizes in both themes`,
  );

  if (!baseline) {
    await setSize(940, 640);
    await selectSection("accounts");
    await check("section changes reset settings scroll to top", async () => {
      const scroll = await page.locator("#settings-panel").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
        return node.scrollTop;
      });
      assert.ok(scroll > 0, "Fixture must create a scrollable settings page");
      await selectSection("appearance");
      await page.waitForFunction(
        () => document.getElementById("settings-panel").scrollTop === 0,
      );
    });
    await check(
      "vertical keyboard tabs expose one selected tab and linked panel",
      async () => {
        await selectSection("accounts");
        const tabs = page.locator(".settings-tabs [data-tab]");
        assert.equal(
          await page
            .locator('.settings-tabs[role="tablist"]')
            .getAttribute("aria-orientation"),
          "vertical",
        );
        await page.locator('[data-tab="accounts"]').focus();
        for (const [key, selected] of [
          ["ArrowDown", "appearance"],
          ["End", "updates"],
          ["ArrowDown", "accounts"],
          ["ArrowUp", "updates"],
          ["Home", "accounts"],
        ]) {
          await page.keyboard.press(key);
          await page.waitForFunction(
            (id) =>
              document.activeElement?.dataset.tab === id &&
              !document.getElementById(`tab-${id}`).hidden,
            selected,
          );
          const state = await tabs.evaluateAll((nodes) =>
            nodes.map((node) => ({
              tab: node.dataset.tab,
              id: node.id,
              role: node.getAttribute("role"),
              selected: node.getAttribute("aria-selected"),
              index: node.tabIndex,
              controls: node.getAttribute("aria-controls"),
            })),
          );
          assert.equal(
            state.filter((tab) => tab.selected === "true").length,
            1,
          );
          assert.equal(state.filter((tab) => tab.index === 0).length, 1);
          for (const tab of state) {
            assert.equal(tab.role, "tab");
            assert.equal(tab.controls, `tab-${tab.tab}`);
            assert.equal(tab.selected, String(tab.tab === selected));
            assert.equal(tab.index, tab.tab === selected ? 0 : -1);
            assert.equal(
              await page.locator(`#${tab.controls}`).getAttribute("role"),
              "tabpanel",
            );
            assert.equal(
              await page
                .locator(`#${tab.controls}`)
                .getAttribute("aria-labelledby"),
              tab.id,
            );
          }
        }
      },
    );
    await check(
      "account menus close on Escape, outside click, and section changes",
      async () => {
        await selectSection("accounts");
        await top();
        const first = page.locator('.more-menu[data-account-id="zalo"]');
        const second = page.locator(".more-menu").nth(1);
        await first.locator("summary").click();
        assert.equal(await first.getAttribute("open"), "");
        // The first popup overlays the next row; keyboard activation tests the
        // native details group without clicking through the open menu.
        await second.locator("summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(".more-menu[open]").count(), 1);
        assert.equal(await first.getAttribute("open"), null);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".more-menu[open]").count(), 0);
        assert.ok(
          await second
            .locator("summary")
            .evaluate((node) => document.activeElement === node),
        );
        await first.locator("summary").click();
        await page.locator(".settings-heading h2").click();
        assert.equal(await page.locator(".more-menu[open]").count(), 0);
        await first.locator("summary").click();
        await selectSection("appearance");
        assert.equal(await page.locator(".more-menu[open]").count(), 0);
      },
    );
    await check(
      "one Escape closes command palette with an account menu open behind it",
      async () => {
        await selectSection("accounts");
        await page.locator('[data-focus="more-zalo"]').focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(
          () =>
            document.querySelector('.more-menu[data-account-id="zalo"]').open,
        );
        await page.evaluate(() => window.desktop.command(true));
        await page.waitForFunction(
          () => document.getElementById("command-dialog").open,
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => !document.getElementById("command-dialog").open,
        );
        await page.waitForFunction(
          () => !window.__settingsCheckState.commandOpen,
        );
        await selectSection("appearance");
      },
    );
    await check(
      "account add dialog opens, cancels, and edit saves through the form",
      async () => {
        await selectSection("accounts");
        await page.locator("#add-account-settings").click();
        await page.waitForFunction(
          () => document.getElementById("account-editor").open,
        );
        await page.locator("#account-name").fill("   ");
        await page.locator("#account-editor-save").click();
        assert.equal(
          await page
            .locator("#account-name")
            .evaluate((node) => node.validity.customError),
          true,
          "A whitespace-only account name must be rejected",
        );
        assert.equal(
          await page.locator("#account-editor").evaluate((node) => node.open),
          true,
        );
        assert.equal(
          (await page.evaluate(() => window.desktop.state())).accounts.length,
          6,
        );
        await page.locator("#account-name").fill("Tài khoản chưa lưu");
        assert.equal(
          await page
            .locator("#account-name")
            .evaluate((node) => node.validity.customError),
          false,
          "Typing a valid name must clear the inline validation error",
        );
        await page.locator("#account-editor-cancel").click();
        await page.waitForFunction(
          () => !document.getElementById("account-editor").open,
        );
        assert.equal(
          (await page.evaluate(() => window.desktop.state())).accounts.length,
          6,
        );
        await page.locator('[data-focus="edit-zalo"]').click();
        await page.waitForFunction(
          () => document.getElementById("account-editor").open,
        );
        await page.locator("#account-name").fill("Bộ phận hỗ trợ đã đổi tên");
        await page.locator("#account-avatar").fill("HT");
        await page.locator("#account-editor-save").click();
        await page.waitForFunction(
          () =>
            !document.getElementById("account-editor").open &&
            window.__settingsCheckState.accounts.find(
              (account) => account.id === "zalo",
            ).name === "Bộ phận hỗ trợ đã đổi tên",
        );
      },
    );
    await check(
      "theme choices and automatic mode update application state",
      async () => {
        await selectSection("appearance");
        for (const theme of ["dark", "light"]) {
          await page.locator(`[data-theme-choice="${theme}"]`).click();
          await page.waitForFunction(
            (value) =>
              document.documentElement.dataset.theme === value &&
              window.__settingsCheckState.presentation.theme === value,
            theme,
          );
        }
        await page.locator("#theme-mode").selectOption("system");
        await page.waitForFunction(
          () => window.__settingsCheckState.presentation.theme === "system",
        );
      },
    );
    await check(
      "notification switch and account policy save through visible controls",
      async () => {
        await selectSection("notifications");
        await page.locator("#pause-notifications").check();
        await page.waitForFunction(
          () => window.__settingsCheckState.preferences.paused,
        );
        await page.locator("#pause-notifications").uncheck();
        await page.waitForFunction(
          () => !window.__settingsCheckState.preferences.paused,
        );
        await page.locator("#notification-zalo").selectOption("mute");
        await page.waitForFunction(
          () =>
            window.__settingsCheckState.preferences.notifications.zalo ===
            "mute",
        );
      },
    );
    await check(
      "notification pickers render in both themes, select by click, and fit near the window edge",
      async () => {
        await setSize(1024, 720);
        await selectSection("notifications");
        await page.locator("#notification-zalo").selectOption("ask");
        const backgrounds = [];
        for (const theme of ["light", "dark"]) {
          await setTheme(theme);
          await top();
          const picker = await openPicker("#notification-zalo");
          backgrounds.push(picker.pickerBackground);
          await page.screenshot({
            path: join(output, `${prefix}-${theme}-notification-picker.png`),
            animations: "disabled",
          });
          await closePicker("#notification-zalo");
          assert.equal(
            await page.locator("#notification-zalo").inputValue(),
            "ask",
          );
        }
        assert.notEqual(
          backgrounds[0],
          backgrounds[1],
          "Picker must follow the app theme",
        );
        await openPicker("#notification-zalo");
        await page.locator('#notification-zalo option[value="allow"]').click();
        await page.waitForFunction(
          () =>
            window.__settingsCheckState.preferences.notifications.zalo ===
              "allow" &&
            !document.getElementById("notification-zalo").matches(":open"),
        );
        assert.equal(await page.locator("#test-zalo").isDisabled(), false);
        const last = page.locator(".notification-row select").last();
        const lastSelector = `#${await last.getAttribute("id")}`;
        await openPicker(lastSelector);
        await closePicker(lastSelector);
      },
    );
    await check(
      "select keyboard interaction commits a choice and Escape cancels without changing it",
      async () => {
        await selectSection("appearance");
        await page.locator("#theme-mode").selectOption("system");
        await page.waitForFunction(
          () => window.__settingsCheckState.presentation.theme === "system",
        );
        await openPicker("#theme-mode", true);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForFunction(
          () =>
            !document.getElementById("theme-mode").matches(":open") &&
            window.__settingsCheckState.presentation.theme === "light",
        );
        await openPicker("#theme-mode", true);
        await page.keyboard.press("ArrowDown");
        await closePicker("#theme-mode");
        assert.equal(await page.locator("#theme-mode").inputValue(), "light");
        assert.equal(
          await page.evaluate(
            () => window.__settingsCheckState.presentation.theme,
          ),
          "light",
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#theme-mode")
            .evaluate((node) => document.activeElement === node),
          false,
          "Tab must move out of the closed select",
        );
      },
    );
    await check(
      "notification switches support the full label and keyboard with an explained disabled action",
      async () => {
        await selectSection("notifications");
        const pause = page.locator("#pause-notifications");
        assert.equal(await pause.getAttribute("role"), "switch");
        await pause.locator("..").locator("span").first().click();
        await page.waitForFunction(
          () => window.__settingsCheckState.preferences.paused,
        );
        assert.equal(await pause.isChecked(), true);
        const test = page.locator("#test-zalo");
        assert.equal(await test.isDisabled(), true);
        const hintId = await test.getAttribute("aria-describedby");
        assert.equal(hintId, "notification-hint-zalo");
        const hint = page.locator(`#${hintId}`);
        assert.equal(await hint.isVisible(), true);
        assert.match(await hint.textContent(), /bật lại thông báo/i);
        await test.evaluate((node) =>
          Promise.all(
            node.getAnimations().map((animation) => animation.finished),
          ),
        );
        const background = await test.evaluate(
          (node) => getComputedStyle(node).backgroundColor,
        );
        await test.hover();
        await test.evaluate((node) =>
          Promise.all(
            node.getAnimations().map((animation) => animation.finished),
          ),
        );
        assert.equal(
          await test.evaluate((node) => getComputedStyle(node).backgroundColor),
          background,
          "Disabled action must not show an enabled hover state",
        );
        await pause.focus();
        await page.keyboard.press("Space");
        await page.waitForFunction(
          () => !window.__settingsCheckState.preferences.paused,
        );
        assert.equal(await test.isDisabled(), false);
        const focus = await pause.evaluate((node) => ({
          visible: node.matches(":focus-visible"),
          outline: getComputedStyle(node).outlineStyle,
          width: parseFloat(getComputedStyle(node).outlineWidth),
          shadow: getComputedStyle(node).boxShadow,
        }));
        assert.ok(
          focus.visible &&
            ((focus.outline !== "none" && focus.width > 0) ||
              focus.shadow !== "none"),
        );
        await page.locator("#notification-zalo").selectOption("mute");
        await page.waitForFunction(
          () =>
            window.__settingsCheckState.preferences.notifications.zalo ===
            "mute",
        );
        assert.equal(await test.isDisabled(), true);
        assert.match(await hint.textContent(), /cho phép/i);
      },
    );
    await check(
      "account provider picker stays above its modal and Escape preserves the editor",
      async () => {
        await selectSection("accounts");
        await page.locator("#add-account-settings").click();
        await page.waitForFunction(
          () => document.getElementById("account-editor").open,
        );
        const previous = await page.locator("#account-provider").inputValue();
        await openPicker("#account-provider", true);
        await page.keyboard.press("ArrowDown");
        await page.screenshot({
          path: join(output, `${prefix}-account-editor-picker.png`),
          animations: "disabled",
        });
        await closePicker("#account-provider");
        assert.equal(
          await page.locator("#account-provider").inputValue(),
          previous,
        );
        assert.equal(
          await page.locator("#account-editor").evaluate((node) => node.open),
          true,
        );
        await openPicker("#account-provider");
        await page
          .locator('#account-provider option[value="telegram"]')
          .click();
        assert.equal(
          await page.locator("#account-provider").inputValue(),
          "telegram",
        );
        await page.locator("#account-editor-cancel").click();
        await page.waitForFunction(
          () => !document.getElementById("account-editor").open,
        );
      },
    );
    await check(
      "import pickers contain long labels and empty sources expose explanatory placeholders",
      async () => {
        await selectSection("accounts");
        await page.locator(".import-section summary").click();
        const closedProfile = await page
          .locator("#profiles")
          .evaluate((node) => ({
            height: node.getBoundingClientRect().height,
            targetHeight: document
              .getElementById("messenger-target")
              .getBoundingClientRect().height,
            whiteSpace: getComputedStyle(node).whiteSpace,
          }));
        assert.equal(
          closedProfile.height,
          36,
          "A long selected profile must stay on one line",
        );
        assert.equal(
          closedProfile.height,
          closedProfile.targetHeight,
          "Import fields must remain aligned",
        );
        assert.equal(closedProfile.whiteSpace, "nowrap");
        await openPicker("#profiles");
        await page.screenshot({
          path: join(output, `${prefix}-import-profile-picker.png`),
          animations: "disabled",
        });
        await closePicker("#profiles");
        const original = await page.evaluate(() => window.desktop.state());
        try {
          // Only renderer state is replaced; the fixture's real account catalog
          // and source discovery remain unchanged and are restored below.
          const empty = {
            ...original,
            profiles: [],
            accounts: original.accounts.map((account) => ({
              ...account,
              archived: account.provider === "messenger" || account.archived,
            })),
          };
          await client.evaluate(({ BrowserWindow }, state) => {
            BrowserWindow.getAllWindows()[0].webContents.send("state", state);
          }, empty);
          await page.waitForFunction(
            () =>
              document.getElementById("profiles").disabled &&
              document.getElementById("messenger-target").disabled,
          );
          for (const selector of ["#profiles", "#messenger-target"]) {
            assert.equal(await page.locator(selector).inputValue(), "");
            assert.ok(
              (
                await page.locator(`${selector} option:checked`).textContent()
              ).trim(),
            );
          }
          assert.equal(await page.locator("#import").isDisabled(), true);
          assert.equal(await page.locator("#import-hint").isVisible(), true);
          assert.ok((await page.locator("#import-hint").textContent()).trim());
          await page.locator("#profiles").scrollIntoViewIfNeeded();
          await assertGeometry("empty-import-sources");
          await page.screenshot({
            path: join(output, `${prefix}-import-empty-sources.png`),
            animations: "disabled",
          });
        } finally {
          await client.evaluate(({ BrowserWindow }, state) => {
            BrowserWindow.getAllWindows()[0].webContents.send("state", state);
          }, original);
        }
        await page.waitForFunction(
          () => !document.getElementById("profiles").disabled,
        );
        await page.locator(".import-section summary").click();
      },
    );
    await check(
      "macOS and update switches remain functional in the fixture",
      async () => {
        await selectSection("macos");
        await page.locator("#global-shortcut").check();
        await page.waitForFunction(
          () => window.__settingsCheckState.preferences.shortcut,
        );
        await page.locator("#global-shortcut").uncheck();
        await page.waitForFunction(
          () => !window.__settingsCheckState.preferences.shortcut,
        );
        await selectSection("updates");
        await page.locator("#auto-check-updates").check();
        await page.waitForFunction(
          () => window.__settingsCheckState.preferences.updateChecks,
        );
        await page.locator("#auto-check-updates").uncheck();
        await page.waitForFunction(
          () => !window.__settingsCheckState.preferences.updateChecks,
        );
      },
    );
    await check(
      "back to chat restores the selected synthetic account",
      async () => {
        const active = await page.evaluate(
          () => window.__settingsCheckState.active,
        );
        await page.locator("#close-settings").click();
        await page.waitForFunction(
          (id) =>
            window.__settingsCheckState.panel === "service" &&
            window.__settingsCheckState.active === id &&
            document.getElementById("settings-panel").hidden,
          active,
        );
        const visible = await client.evaluate(async ({ BrowserWindow }) => {
          const views =
            BrowserWindow.getAllWindows()[0].contentView.children.filter(
              (view) => view.getVisible(),
            );
          return Promise.all(
            views.map(async (view) => ({
              id: view.webContents.id,
              fixture: await view.webContents.executeJavaScript(
                "document.documentElement.dataset.settingsFixture === 'true'",
              ),
            })),
          );
        });
        assert.equal(visible.length, 1);
        assert.equal(visible[0].fixture, true);
      },
    );
  }
  assert.deepEqual(errors, [], "No renderer errors");
  assert.deepEqual(
    await client.evaluate(() => globalThis.settingsFixture.external),
    [],
    "No external navigation",
  );
} finally {
  await writeFile(
    join(output, `${prefix}-results.json`),
    JSON.stringify({ baseline, results, errors }, null, 2),
  );
  if (client) await client.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
console.log(
  `${baseline ? "Baseline captured" : "Settings UI checks passed"}: ${output}`,
);
