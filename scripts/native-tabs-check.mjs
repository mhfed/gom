// Run after `npm run build`. This owns only an isolated Electron fixture:
// fresh appData, fake Chrome home, synthetic HTTPS, and no real account access.
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import sharp from "sharp";

const project = fileURLToPath(new URL("..", import.meta.url));
const output = join(project, "outputs/native-tabs");
const entry = join(project, "dist/main.cjs");
await access(entry);
const root = await mkdtemp(join(tmpdir(), "tin-nhan-native-tabs-"));
const bootstrap = join(root, "bootstrap.cjs");
const providers = ["zalo", "telegram", "messenger"];
const cases = [];
const errors = [];
let client;
let page;
let baseline;

// The fixture deliberately announces itself in captures. It is not a proposed
// unified chat or a claim about any real provider's interface/integration.
const fixtureHTML = `<!doctype html><html lang="vi" data-native-tabs-fixture="true"><head><meta charset="utf-8"><style>
:root{color-scheme:light dark;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:light-dark(#fff,#202124);color:light-dark(#27282b,#efeff1)}*{box-sizing:border-box}body{margin:0;height:100vh;display:grid;grid-template-columns:250px 1fr}aside{border-right:1px solid light-dark(#e5e5e8,#35363a);padding:25px 18px;background:light-dark(#f8f8fa,#26272a)}h1{font-size:20px;margin:0 0 18px}input{width:100%;padding:9px;border:1px solid light-dark(#ddd,#444);border-radius:7px;background:light-dark(#fff,#202124)}.row{padding:16px 10px;border-radius:8px;margin-top:14px;background:light-dark(#e9eef7,#343d50)}.row b,.row small{display:block}.row small{margin-top:7px;color:light-dark(#72757d,#a8abb4)}main{display:flex;flex-direction:column;padding:25px 30px;min-width:0}header{border-bottom:1px solid light-dark(#eee,#35363a);padding-bottom:20px}header b{font-size:16px}header small{display:block;margin-top:6px;color:light-dark(#81838a,#a0a3ab)}.messages{flex:1;padding-top:35px}.bubble{max-width:340px;padding:14px 17px;background:light-dark(#f0f0f3,#303136);border-radius:16px;line-height:1.6}.bubble+.bubble{margin:20px 0 0 auto;background:light-dark(#e7efff,#243855)}textarea{font:inherit;width:100%;height:76px;resize:none;padding:15px;border:1px solid light-dark(#dedfe4,#45474d);border-radius:11px;background:light-dark(#fafafa,#28292c);color:inherit}.note{font-size:11px;color:light-dark(#8a8d95,#9da0aa);text-align:center;margin:12px 0 0}.probe{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style></head><body><aside><h1 id="platform-name"></h1><input id="contact-search-input" placeholder="Tìm cuộc trò chuyện" aria-label="Tìm cuộc trò chuyện"><div class="row"><b>Nhóm kiểm thử</b><small>Dữ liệu giả · không có tài khoản thật</small></div><div class="chatlist probe"><a data-peer-id="fixture"></a></div><button class="probe" aria-label="New message">New message</button></aside><main><header><b>Nhóm kiểm thử giao diện</b><small>Hồ sơ tạm, không kết nối dịch vụ bên ngoài</small></header><div class="messages"><div class="bubble">Đổi tab để kiểm tra trạng thái trang chat.</div><div class="bubble">Bản nháp vẫn ở đây khi quay lại.</div></div><textarea id="draft" aria-label="Bản nháp kiểm thử" placeholder="Nhập bản nháp kiểm thử…"></textarea><p class="note">TRANG GIẢ LẬP CHO KIỂM THỬ · KHÔNG PHẢI GIAO DIỆN NỀN TẢNG</p></main><script>document.querySelector('#platform-name').textContent=location.hostname.includes('zalo')?'Zalo':location.hostname.includes('telegram')?'Telegram':'Messenger';document.documentElement.dataset.documentToken=crypto.randomUUID();</script></body></html>`;

await writeFile(
  bootstrap,
  `const e = require('electron');
const root = ${JSON.stringify(root)};
e.app.setPath('appData', root);
require('node:os').homedir = () => root;
// Confirm only synthetic archive dialogs; no OS/external actions are exercised.
e.dialog.showMessageBox = async () => ({ response: 1 });
e.shell.openExternal = async () => { throw Error('Unexpected external navigation in fixture'); };
globalThis.nativeTabsFixture = { requests: {}, sessions: new Map(), accountMenu: null };
// Intercept only the native popup surface. Items and their click handlers are
// the production Electron Menu, while the fixture controls selection/cancel.
const originalPopup = e.Menu.prototype.popup;
e.Menu.prototype.popup = function (options) {
  if (this.items.some((item) => item.id?.startsWith('account-'))) {
    if (globalThis.nativeTabsFixture.accountMenu) throw Error('Account menu opened twice');
    globalThis.nativeTabsFixture.accountMenu = { menu: this, options };
    return;
  }
  return originalPopup.call(this, options);
};
const original = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = original(...args);
  if (!globalThis.nativeTabsFixture.sessions.has(ses)) {
    const partition = args[0];
    globalThis.nativeTabsFixture.sessions.set(ses, partition);
    globalThis.nativeTabsFixture.requests[partition] = 0;
    const respond = () => {
      globalThis.nativeTabsFixture.requests[partition]++;
      return new Response(${JSON.stringify(fixtureHTML)}, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    ses.protocol.handle('https', respond);
    ses.protocol.handle('http', respond);
  }
  return ses;
};
require(${JSON.stringify(entry)});
`,
);

const state = () => page.evaluate(() => window.desktop.state());
async function eventually(label, predicate, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw Error(`Timed out: ${label}`);
}
async function native() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const fixture = globalThis.nativeTabsFixture;
    return Promise.all(
      BrowserWindow.getAllWindows()[0].contentView.children.map(
        async (view) => {
          const contents = view.webContents;
          const partition = fixture.sessions.get(contents.session);
          const document = await contents.executeJavaScript(`(() => {
          const root = document.documentElement;
          return { fixture: root.dataset.nativeTabsFixture === 'true',
            token: root.dataset.documentToken, draft: document.querySelector('#draft')?.value,
            focusedElement: document.activeElement?.id,
            selectionStart: document.querySelector('#draft')?.selectionStart,
            selectionEnd: document.querySelector('#draft')?.selectionEnd };
        })()`);
          return {
            id: contents.id,
            account: partition?.replace(/^persist:(?:tn-account-)?/, ""),
            partition,
            requests: fixture.requests[partition],
            visible: view.getVisible(),
            focused: contents.isFocused(),
            bounds: view.getBounds(),
            ...document,
          };
        },
      ),
    );
  });
}
async function active(account, { focus = true } = {}) {
  try {
    await eventually(`active account ${account}`, async () => {
      const current = await state();
      const visible = (await native()).filter((view) => view.visible);
      return (
        current.panel === "service" &&
        current.active === account &&
        visible.length === 1 &&
        visible[0].account === account &&
        (!focus || visible[0].focused)
      );
    });
  } catch (error) {
    const snapshot = await state();
    const windowFocused = await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isFocused(),
    );
    throw Error(
      `${error.message}; ${JSON.stringify({ active: snapshot.active, panel: snapshot.panel, commandOpen: snapshot.commandOpen, windowFocused, views: (await native()).map(({ account, visible, focused, bounds }) => ({ account, visible, focused, bounds })) })}`,
    );
  }
  const current = await state();
  const provider = current.accounts.find(
    (item) => item.id === account,
  ).provider;
  assert.equal(
    await page.locator(`#platform-${provider}`).getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page.locator("#account-select").evaluate((node) => node.value),
    account,
  );
  assert.equal(
    await page.locator("#account-select-label").textContent(),
    current.accounts.find((item) => item.id === account).name,
  );
  assert.equal(
    await page.locator("#account-select").getAttribute("aria-haspopup"),
    "menu",
  );
  const tabs = await page
    .locator('[role="tab"][id^="platform-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.id,
        selected: node.getAttribute("aria-selected"),
        index: node.tabIndex,
      })),
    );
  assert.deepEqual(
    tabs.map((tab) => tab.id),
    providers.map((id) => `platform-${id}`),
  );
  assert.equal(tabs.filter((tab) => tab.selected === "true").length, 1);
  assert.deepEqual(
    tabs.map((tab) => tab.index),
    providers.map((id) => (id === provider ? 0 : -1)),
  );
}
async function openAccountMenu({ keyboard = false } = {}) {
  const before = await state();
  const provider = before.accounts.find(
    (account) => account.id === before.active,
  ).provider;
  const button = page.locator("#account-select");
  assert.equal(await button.evaluate((node) => node.tagName), "BUTTON");
  const anchor = await button.boundingBox();
  if (keyboard) {
    await client.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.focus(),
    );
    await button.focus();
    await page.keyboard.press("ArrowDown");
  } else await button.click();
  await eventually("native account menu", () =>
    client.evaluate(() => !!globalThis.nativeTabsFixture.accountMenu),
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#account-select")
        .getAttribute("aria-expanded") === "true",
  );
  const menu = await client.evaluate(({ BrowserWindow }) => {
    const { menu, options } = globalThis.nativeTabsFixture.accountMenu;
    return {
      entries: menu.items.map((item) => ({
        id: item.id,
        type: item.type,
        checked: item.checked,
        enabled: item.enabled,
      })),
      x: options.x,
      y: options.y,
      correctWindow: options.window === BrowserWindow.getAllWindows()[0],
    };
  });
  assert.deepEqual(
    menu.entries,
    before.accounts
      .filter((account) => !account.archived && account.provider === provider)
      .map((account) => ({
        id: `account-${account.id}`,
        type: "radio",
        checked: account.id === before.active,
        enabled: true,
      })),
  );
  assert.equal(menu.correctWindow, true);
  assert.ok(
    Number.isInteger(menu.x) && Math.abs(menu.x - anchor.x) <= 1,
    "Menu starts at its account button",
  );
  assert.ok(
    Number.isInteger(menu.y) &&
      menu.y >= anchor.y + anchor.height &&
      menu.y <= 60,
    "Menu opens below the compact header control",
  );
  return before;
}
async function finishAccountMenu(account) {
  await client.evaluate(({ BrowserWindow }, account) => {
    const captured = globalThis.nativeTabsFixture.accountMenu;
    if (!captured) throw Error("Missing captured native account menu");
    globalThis.nativeTabsFixture.accountMenu = null;
    if (account) {
      const item = captured.menu.getMenuItemById(`account-${account}`);
      if (!item) throw Error(`Missing account menu item ${account}`);
      item.click(item, BrowserWindow.getAllWindows()[0], {});
    }
    captured.options.callback();
  }, account);
  await page.waitForFunction(
    () =>
      document
        .querySelector("#account-select")
        .getAttribute("aria-expanded") === "false",
  );
}
async function selectAccount(account) {
  await openAccountMenu();
  await finishAccountMenu(account);
}
async function check(name, run) {
  // Input assertions concern the foreground fixture. Production intentionally
  // does not steal OS focus if another app becomes active during a test run.
  await client.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });
  await run();
  cases.push(name);
  console.log(`PASS ${name}`);
}
async function preserved() {
  const current = await native();
  assert.equal(current.length, baseline.length);
  for (const before of baseline) {
    const after = current.find((view) => view.account === before.account);
    assert.ok(after?.fixture, "Every native page must be synthetic");
    for (const key of [
      "id",
      "partition",
      "requests",
      "token",
      "draft",
      "focusedElement",
      "selectionStart",
      "selectionEnd",
    ])
      assert.equal(
        after[key],
        before[key],
        `${before.account}: ${key} changed`,
      );
  }
}
async function capture(theme) {
  await page.evaluate((value) => window.desktop.setTheme(value), theme);
  await page.waitForFunction(
    (value) => document.documentElement.dataset.theme === value,
    theme,
  );
  await page.evaluate(() => window.desktop.activate("zalo"));
  await active("zalo", { focus: false });
  await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1024, 720),
  );
  await eventually(
    "1024-wide native view",
    async () =>
      (await native()).find((view) => view.visible)?.bounds.width === 1024,
  );
  await page.mouse.move(512, 80);
  await page.waitForTimeout(180);
  // Shell capture omits native child views in Playwright. Composite screenshots
  // from the two actual surfaces; never render invented provider data into shell.
  const shell = await page.screenshot();
  const child = await client.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
      (item) => item.getVisible(),
    );
    return {
      bounds: view.getBounds(),
      png: (await view.webContents.capturePage()).toPNG().toString("base64"),
    };
  });
  const metadata = await sharp(shell).metadata();
  const scale = metadata.width / 1024;
  const png = await sharp(Buffer.from(child.png, "base64"))
    .resize(
      Math.round(child.bounds.width * scale),
      Math.round(child.bounds.height * scale),
    )
    .toBuffer();
  await sharp(shell)
    .composite([
      {
        input: png,
        left: Math.round(child.bounds.x * scale),
        top: Math.round(child.bounds.y * scale),
      },
    ])
    .toFile(join(output, `${theme}-1024.png`));
}

try {
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
  await page.waitForFunction(
    () => typeof window.desktop?.activateProvider === "function",
  );
  assert.equal(
    await client.evaluate(({ app }) => app.getPath("userData")),
    join(root, "TinNhanDesktop"),
  );
  assert.deepEqual(
    (await state()).profiles,
    [],
    "No real Chrome profiles may be visible",
  );
  await mkdir(output, { recursive: true });

  await check(
    "rebrand retains the legacy encryption and profile identity",
    async () => {
      const identity = await client.evaluate(({ app }) => ({
        name: app.getName(),
        userData: app.getPath("userData"),
        sessionData: app.getPath("sessionData"),
        mockKeychain: app.commandLine.hasSwitch("use-mock-keychain"),
      }));
      assert.equal(
        identity.name,
        "Tin Nhan",
        "Changing this name selects a different macOS encryption key",
      );
      assert.equal(identity.userData, join(root, "TinNhanDesktop"));
      assert.equal(identity.sessionData, identity.userData);
      assert.equal(identity.mockKeychain, true);
    },
  );

  let second;
  let archived;
  await check(
    "isolated profile and provider-specific account selector",
    async () => {
      second = await page.evaluate(() =>
        window.desktop.addAccount("zalo", "Công việc", "CV"),
      );
      archived = await page.evaluate(() =>
        window.desktop.addAccount("zalo", "Đã lưu trữ", "LT"),
      );
      assert.equal(second.ok, true);
      assert.equal(archived.ok, true);
      assert.equal(
        (
          await page.evaluate(
            (id) => window.desktop.archiveAccount(id),
            archived.accountId,
          )
        ).ok,
        true,
      );
      for (const account of [...providers, second.accountId]) {
        await page.evaluate((id) => window.desktop.activate(id), account);
        await eventually("synthetic pages loaded", async () =>
          (await native()).every((view) => view.fixture && view.token),
        );
        await active(account);
      }
      await client.evaluate(async ({ BrowserWindow }) => {
        for (const view of BrowserWindow.getAllWindows()[0].contentView
          .children)
          await view.webContents.executeJavaScript(`(() => {
          const input = document.querySelector('#draft');
          input.value = ${JSON.stringify("Bản nháp kiểm thử — ")} + ${view.webContents.id};
          input.focus(); input.setSelectionRange(4, 12);
        })()`);
      });
      baseline = await native();
      assert.equal(baseline.length, 4);
    },
  );

  await check(
    "native account menu filters archived and other-provider accounts, cancels without losing drafts",
    async () => {
      const before = await openAccountMenu();
      assert.equal(
        await page
          .locator("#account-select")
          .evaluate((node) => node.matches(":focus-visible")),
        false,
        "Pointer clicks should not add a keyboard focus ring",
      );
      await finishAccountMenu();
      await active(before.active, { focus: false });
      await preserved();
    },
  );

  await check(
    "keyboard account menu cancellation retains shell keyboard focus",
    async () => {
      const before = await openAccountMenu({ keyboard: true });
      await finishAccountMenu();
      await active(before.active, { focus: false });
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "account-select",
      );
      assert.equal(
        await client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.isFocused(),
        ),
        true,
      );
      await preserved();
    },
  );

  await check(
    "stale native account menu cannot switch after changing provider",
    async () => {
      await openAccountMenu();
      await page.evaluate(() => window.desktop.activateProvider("telegram"));
      await active("telegram");
      await finishAccountMenu("zalo");
      await active("telegram");
      await preserved();
      await page.evaluate(() => window.desktop.activateProvider("zalo"));
      await active(second.accountId);
    },
  );

  await check(
    "platform tabs remember the selected account and preserve loaded pages",
    async () => {
      await page.locator("#platform-telegram").click();
      await active("telegram");
      await page.locator("#platform-zalo").click();
      await active(second.accountId);
      await selectAccount("zalo");
      await active("zalo");
      await page.locator("#platform-messenger").click();
      await active("messenger");
      await page.locator("#platform-zalo").click();
      await active("zalo");
      await selectAccount(second.accountId);
      await active(second.accountId);
      await page.locator("#platform-telegram").click();
      await active("telegram");
      await page.locator("#platform-zalo").click();
      await active(second.accountId);
      await preserved();
    },
  );

  await check(
    "external activation synchronizes tabs and account selection",
    async () => {
      await page.evaluate(() => window.desktop.activate("messenger"));
      await active("messenger");
      await page.evaluate(
        (id) => window.desktop.activate(id),
        second.accountId,
      );
      await active(second.accountId);
      await page.evaluate(() => window.desktop.activateProvider("telegram"));
      await active("telegram");
      await page.evaluate(() => window.desktop.activateProvider("zalo"));
      await active(second.accountId);
    },
  );

  await check(
    "keyboard roving tabs follow Zalo, Telegram, Messenger order",
    async () => {
      // locator.focus() alone changes DOM focus, not Electron's focused child
      // WebContents. Enter the shell before exercising its keyboard controls.
      await client.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.focus(),
      );
      await page.locator("#platform-zalo").focus();
      await page.keyboard.press("ArrowRight");
      await active("telegram", { focus: false });
      assert.equal(
        await client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.isFocused(),
        ),
        true,
        "Arrow-key activation must retain shell focus for the next arrow key",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "platform-telegram",
      );
      await page.keyboard.press("ArrowRight");
      await active("messenger", { focus: false });
      for (const [from, key, expected] of [
        ["zalo", "ArrowRight", "telegram"],
        ["telegram", "ArrowRight", "messenger"],
        ["messenger", "ArrowRight", second.accountId],
        ["zalo", "ArrowLeft", "messenger"],
        ["messenger", "Home", second.accountId],
        ["zalo", "End", "messenger"],
      ]) {
        await page.locator(`#platform-${from}`).press(key);
        await active(expected, { focus: false });
      }
      const accelerators = await client.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()
          .items.flatMap((item) => item.submenu?.items ?? [])
          .filter((item) => /\+[123]$/.test(item.accelerator ?? ""))
          .map((item) => ({
            label: item.label,
            accelerator: item.accelerator,
          })),
      );
      assert.deepEqual(
        accelerators,
        ["Zalo", "Telegram", "Messenger"].map((label, index) => ({
          label,
          accelerator: `CmdOrCtrl+${index + 1}`,
        })),
      );
    },
  );

  await check(
    "settings and command palette hide native pages and restore focus",
    async () => {
      await page.evaluate(() => window.desktop.activate("telegram"));
      await active("telegram");
      await page.locator("#settings").click();
      await eventually(
        "settings visible",
        async () => (await state()).panel === "settings",
      );
      assert.ok((await native()).every((view) => !view.visible));
      await page.locator("#platform-telegram").click();
      await active("telegram");
      await page.locator("#quick-switch").click();
      await page.locator("#command-dialog").waitFor({ state: "visible" });
      assert.ok((await native()).every((view) => !view.visible));
      await page.keyboard.press("Escape");
      await active("telegram");
      await page.locator("#quick-switch").click();
      await page.locator("#command-search").fill("messenger");
      await page.keyboard.press("Enter");
      await active("messenger");
      assert.equal(await page.locator("#navigation-menu").isVisible(), true);
      assert.equal(await page.locator("#navigation-menu").isEnabled(), true);
      await preserved();
    },
  );

  await check(
    "toolbar adds an account in the selected platform without losing drafts",
    async () => {
      await page.locator("#platform-telegram").click();
      await active("telegram");
      await page.locator("#add-account-toolbar").click();
      await page.locator("#account-editor").waitFor({ state: "visible" });
      assert.equal(
        await page.locator("#account-provider").inputValue(),
        "telegram",
      );
      assert.ok((await native()).every((view) => !view.visible));
      await page.locator("#account-name").fill("Bản nháp tên tài khoản");
      await page.evaluate(() => window.desktop.setTheme("dark"));
      assert.equal(
        await page.locator("#account-name").inputValue(),
        "Bản nháp tên tài khoản",
      );
      await page.locator("#account-editor-cancel").click();
      await page.locator("#platform-telegram").click();
      await active("telegram");
      await preserved();
    },
  );

  await check(
    "native views fill the window below the 52px toolbar at 940 and 1280",
    async () => {
      for (const [width, height] of [
        [940, 640],
        [1280, 840],
      ]) {
        await client.evaluate(
          ({ BrowserWindow }, size) =>
            BrowserWindow.getAllWindows()[0].setContentSize(...size),
          [width, height],
        );
        await eventually("native resize", async () =>
          (await native()).every(
            (view) =>
              view.bounds.width === width && view.bounds.height === height - 52,
          ),
        );
        const header = await page.locator("header").boundingBox();
        assert.equal(header.y, 0);
        assert.equal(header.height, 52);
        for (const view of await native())
          assert.deepEqual(view.bounds, {
            x: 0,
            y: 52,
            width,
            height: height - 52,
          });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        for (const id of [
          "platform-zalo",
          "platform-telegram",
          "platform-messenger",
          "account-select",
          "add-account-toolbar",
          "quick-switch",
          "settings",
          "navigation-menu",
        ]) {
          const rect = await page.locator(`#${id}`).boundingBox();
          assert.ok(
            rect &&
              rect.x >= 0 &&
              rect.y >= 0 &&
              rect.x + rect.width <= width &&
              rect.y + rect.height <= 52,
            `${id} must fit in toolbar at ${width}`,
          );
        }
      }
    },
  );

  await check(
    "long account names stay truncated inside the compact header",
    async () => {
      const current = await state();
      const account = current.accounts.find(
        (item) => item.id === current.active,
      );
      const name = "Tài khoản công việc của nhóm thiết kế";
      try {
        await page.evaluate(
          ({ id, name, avatar }) =>
            window.desktop.editAccount(id, name, avatar),
          { id: account.id, name, avatar: account.avatar },
        );
        await page.waitForFunction(
          (name) =>
            document.querySelector("#account-select-label").textContent ===
            name,
          name,
        );
        await client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(940, 640),
        );
        await page.waitForFunction(() => innerWidth === 940);
        const layout = await page
          .locator("#account-select-label")
          .evaluate((node) => {
            const style = getComputedStyle(node);
            const label = node.getBoundingClientRect();
            const picker = node.closest("button").getBoundingClientRect();
            return {
              overflow: style.overflow,
              ellipsis: style.textOverflow,
              truncated: node.scrollWidth > node.clientWidth,
              contained:
                label.left >= picker.left && label.right <= picker.right,
              pickerHeight: picker.height,
            };
          });
        assert.deepEqual(layout, {
          overflow: "hidden",
          ellipsis: "ellipsis",
          truncated: true,
          contained: true,
          pickerHeight: 30,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page
          .locator("header")
          .screenshot({ path: join(output, "header-long-name.png") });
      } finally {
        await page.evaluate(
          ({ id, name, avatar }) =>
            window.desktop.editAccount(id, name, avatar),
          account,
        );
      }
      await preserved();
    },
  );

  await check(
    "unchanged state causes zero renderer DOM mutations",
    async () => {
      // Feed the same current snapshot through the real preload IPC listener.
      // No production timers or business state are patched by this check.
      await page.waitForTimeout(180);
      const snapshot = await state();
      await page.evaluate(() => {
        window.nativeTabsMutations = 0;
        window.nativeTabsObserver = new MutationObserver(
          (records) => (window.nativeTabsMutations += records.length),
        );
        window.nativeTabsObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      });
      await client.evaluate(({ BrowserWindow }, snapshot) => {
        for (let i = 0; i < 5; i++)
          BrowserWindow.getAllWindows()[0].webContents.send("state", snapshot);
      }, snapshot);
      await page.waitForTimeout(100);
      const mutations = await page.evaluate(() => {
        window.nativeTabsObserver.disconnect();
        return window.nativeTabsMutations;
      });
      assert.equal(mutations, 0);
    },
  );

  await check(
    "light and dark 1024px fixture captures preserve pages and drafts",
    async () => {
      await capture("light");
      await capture("dark");
      await preserved();
    },
  );

  await check(
    "platform menu shortcuts cannot cover an open account editor",
    async () => {
      await page.locator("#add-account-toolbar").click();
      await page.locator("#account-editor").waitFor({ state: "visible" });
      await page.locator("#account-name").fill("Tên đang nhập, chưa lưu");
      await client.evaluate(({ Menu }) => {
        const item = Menu.getApplicationMenu()
          .items.flatMap((menu) => menu.submenu?.items ?? [])
          .find((item) => item.accelerator === "CmdOrCtrl+2");
        if (!item) throw Error("Missing platform shortcut");
        item.click();
      });
      await page.waitForTimeout(180);
      assert.equal(await page.locator("#account-editor").isVisible(), true);
      assert.equal(
        await page.locator("#account-name").inputValue(),
        "Tên đang nhập, chưa lưu",
      );
      assert.ok(
        (await native()).every((view) => !view.visible),
        "Platform shortcut must not expose a native page over the account editor",
      );
      await page.locator("#account-editor-cancel").click();
      await page.locator("#platform-zalo").click();
      await active("zalo");
    },
  );

  await check(
    "platform with no active accounts opens its account editor",
    async () => {
      // Archive is intentionally destructive to this fixture view; all view and
      // draft preservation assertions run before this explicit lifetime action.
      assert.equal(
        (await page.evaluate(() => window.desktop.archiveAccount("messenger")))
          .ok,
        true,
      );
      await page.locator("#platform-messenger").click();
      await page.locator("#account-editor").waitFor({ state: "visible" });
      assert.equal(
        await page.locator("#account-provider").inputValue(),
        "messenger",
      );
      assert.ok((await native()).every((view) => !view.visible));
      await page.locator("#account-editor-cancel").click();
      await page.locator("#platform-zalo").click();
      await active("zalo");
    },
  );

  assert.deepEqual(errors, [], "Renderer errors");
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(
      {
        pass: true,
        checks: cases.length,
        cases,
        syntheticOnly: true,
        realProfilesAccessed: false,
        screenshots: [
          "light-1024.png",
          "dark-1024.png",
          "header-long-name.png",
        ],
        screenshotMethod:
          "Composite of actual shell and native fixture captures",
        preservedNativePages: baseline.length,
        rendererErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS ${cases.length} native-tabs fixture checks; ${baseline.length} native pages/drafts preserved; screenshots: ${output}`,
  );
} catch (error) {
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(
      {
        pass: false,
        checks: cases.length,
        cases,
        error: error.message,
        rendererErrors: errors,
        syntheticOnly: true,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  if (client) await client.close();
  await rm(root, { recursive: true, force: true });
}
