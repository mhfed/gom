// Isolated renderer check: synthetic IPC and accounts; no provider/session access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright-core";
const source = new URL("../src/renderer/", import.meta.url);
const bundle = await build({
  entryPoints: [new URL("shell.ts", source).pathname],
  write: false,
  bundle: true,
  format: "iife",
  platform: "browser",
});
const browser = await chromium.launch({
  executablePath: process.env.TIN_NHAN_CHROMIUM,
  headless: true,
});
try {
  const page = await browser.newPage({
    bypassCSP: true,
    viewport: { width: 940, height: 700 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(await readFile(new URL("index.html", source), "utf8"));
  await page.addStyleTag({
    content: await readFile(new URL("shell.css", source), "utf8"),
  });
  await page.evaluate(() => {
    const ordinary = {
      id: "zalo",
      provider: "zalo",
      name: "Ordinary",
      avatar: "O",
      archived: false,
    };
    const secret = {
      id: "secret-account",
      provider: "web_secret",
      name: "SECRET_FIXTURE_NAME",
      avatar: "S",
      archived: false,
      private: true,
    };
    const standard = {
      id: "zalo",
      label: "Zalo",
      entry: "https://chat.zalo.me",
      custom: false,
      hosts: ["chat.zalo.me"],
      color: "#067",
    };
    const hidden = {
      id: "web_secret",
      label: "SECRET_FIXTURE_PROVIDER",
      entry: "https://private.example",
      custom: true,
      hosts: ["private.example"],
      color: "#067",
    };
    const record = (value) =>
      Object.fromEntries(
        [ordinary, secret].map((a) => [a.id, structuredClone(value)]),
      );
    window.fixture = {
      accounts: [ordinary],
      providers: [standard],
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
      active: "zalo",
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
    window.calls = [];
    window.emit = () => {};
    window.unlock = () => {
      window.fixture.privateSpace = {
        configured: true,
        unlocked: true,
        unavailable: false,
        lockVersion: window.fixture.privateSpace.lockVersion + 1,
        retryAt: 0,
      };
      window.fixture.accounts = [];
      window.fixture.providers = [standard];
      window.fixture.providerTabs.open = [];
      window.fixture.active = "";
      window.fixture.commandOpen = false;
      window.fixture.panel = "welcome";
      window.emit();
    };
    window.populatePrivate = () => {
      window.fixture.accounts = [secret];
      window.fixture.providers = [standard, hidden];
      window.fixture.providerTabs.open = ["web_secret"];
      window.fixture.active = secret.id;
      window.emit();
    };
    window.lock = () => {
      window.fixture.privateSpace.unlocked = false;
      window.fixture.privateSpace.lockVersion++;
      window.fixture.accounts = [ordinary];
      window.fixture.providers = [standard];
      window.fixture.providerTabs.open = ["zalo"];
      window.fixture.active = "zalo";
      window.fixture.commandOpen = false;
      window.fixture.panel = "service";
      window.emit();
    };
    window.desktop = new Proxy(
      {
        state: async () => structuredClone(window.fixture),
        changed: (callback) => {
          window.emit = () => callback(structuredClone(window.fixture));
        },
        settings: async () => {
          window.fixture.panel = "settings";
          window.emit();
        },
        privateSpace: async (action, data) => {
          window.calls.push({ action, data: structuredClone(data) });
          if (action === "lock") window.lock();
          else if (action === "unlock" && data.password !== "fixture-password")
            return { ok: false, message: "Mật khẩu chưa đúng." };
          else if (action === "setup" || action === "unlock") window.unlock();
          return { ok: true };
        },
        command: async (open) => {
          window.fixture.commandOpen = open;
          window.emit();
        },
        accountEditor: async () => {},
      },
      { get: (object, key) => object[key] || (() => Promise.resolve()) },
    );
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.locator("#private-space-toggle").click();
  assert.equal(
    await page.evaluate(() => window.fixture.panel),
    "service",
    "opening the password dialog must preserve the current workspace panel",
  );
  assert.equal(
    await page.locator("#command-dialog").evaluate((node) => node.open),
    false,
    "the password dialog must not open the command palette",
  );
  await page.locator("#private-password").fill("unfinished-password");
  await page.evaluate(() => window.lock());
  assert.equal(
    await page.locator("#private-space-dialog").evaluate((node) => node.open),
    false,
  );
  assert.equal(await page.locator("#private-password").inputValue(), "");
  await page.locator("#private-space-toggle").click();
  await page.locator("#private-password").fill("fixture-password");
  await page.locator("#private-password-confirm").fill("not-matching");
  await page.locator("#private-space-submit").click();
  assert.match(
    await page.locator("#private-space-error").innerText(),
    /chưa khớp/,
  );
  assert.equal(await page.evaluate(() => window.calls.length), 0);
  await page.locator("#private-password-confirm").fill("fixture-password");
  await page.locator("#private-space-submit").click();
  await page.waitForFunction(
    () => !document.getElementById("private-space-dialog").open,
  );
  assert.equal(await page.locator("#private-password").inputValue(), "");
  assert.equal(
    await page.locator("#private-password-confirm").inputValue(),
    "",
  );
  assert.equal(await page.locator("#workspace-label").innerText(), "Kín");
  assert.equal(
    await page.locator("#welcome-title").innerText(),
    "Không gian kín của bạn.",
  );
  assert.equal(await page.locator("#welcome-empty").isVisible(), true);
  assert.equal(await page.locator("#provider-tabs [role=tab]").count(), 0);
  assert.equal(await page.locator('[data-account-id="zalo"]').count(), 0);
  assert.equal(await page.evaluate(() => window.fixture.commandOpen), false);
  const toolbar = await page.locator("header").evaluate((header) => {
    const items = [
      "#welcome-home",
      ".provider-navigation",
      ".account-picker",
      ".tools",
    ].map((selector) => {
      const r = header.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    return {
      visible: items.every((r) => r.left >= 0 && r.right <= innerWidth),
      separate: items.every((r, i) => !i || r.left >= items[i - 1].right),
    };
  });
  assert.deepEqual(toolbar, { visible: true, separate: true });
  if (process.env.GOM_UI_SCREENSHOT)
    await page.screenshot({ path: process.env.GOM_UI_SCREENSHOT });
  await page.evaluate(() => window.populatePrivate());
  assert.equal(
    await page.locator('[data-focus="account-secret-account-2"]').isDisabled(),
    false,
    "a workspace may archive its sole account when another workspace has accounts",
  );
  assert.equal(
    await page.locator('[data-account-id="secret-account"]').count(),
    2,
  );
  assert.equal(await page.locator("#notification-secret-account").count(), 0);
  assert.equal(
    await page.locator('#import-target option[value="secret-account"]').count(),
    0,
  );
  await page.evaluate(() => {
    window.fixture.panel = "providers";
    window.emit();
  });
  await page.evaluate(() => {
    window.fixture.panel = "settings";
    window.fixture.commandOpen = true;
    window.emit();
  });
  assert.match(
    await page.locator("#command-results").innerText(),
    /SECRET_FIXTURE_NAME/,
  );
  await page.evaluate(() => window.lock());
  assert.equal(await page.locator("#workspace-label").innerText(), "Thường");
  assert.equal(
    await page.evaluate(() =>
      document.body.innerHTML.includes("SECRET_FIXTURE"),
    ),
    false,
  );
  assert.equal(await page.locator("#command-results").innerText(), "");
  await page.evaluate(() => {
    window.unlock();
    window.populatePrivate();
    window.fixture.panel = "service";
    window.emit();
    window.navigationCalls = [];
    window.desktop.providerLibrary = async (open) => {
      window.navigationCalls.push({ action: "library", open });
      window.fixture.panel = "providers";
      window.emit();
    };
    window.desktop.providerMenu = () =>
      new Promise((resolve) => {
        window.finishClose = resolve;
      });
  });
  await page.locator("#platform-web_secret").click({ button: "right" });
  await page.evaluate(async () => {
    window.lock();
    window.finishClose({ ok: false, message: "PRIVATE_CLOSE_FAILURE" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.deepEqual(await page.evaluate(() => window.navigationCalls), []);
  assert.equal(await page.evaluate(() => window.fixture.panel), "service");
  assert.equal(await page.locator("#provider-error").textContent(), "");
  for (const result of [
    { ok: false, message: "PRIVATE_ADD_FAILURE" },
    { ok: true, accountId: "private-created-account" },
  ]) {
    await page.evaluate(() => {
      window.unlock();
      window.fixture.panel = "providers";
      window.emit();
      window.desktop.addProvider = () =>
        new Promise((resolve) => {
          window.finishAdd = resolve;
        });
      window.desktop.activate = async (id) => {
        window.navigationCalls.push({ action: "activate", id });
      };
    });
    await page.locator("#provider-name").fill("Private new site");
    await page.locator("#provider-url").fill("https://private-new.example/");
    await page.locator("#provider-save").click();
    await page.evaluate(async (result) => {
      window.lock();
      window.finishAdd(result);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }, result);
    assert.deepEqual(await page.evaluate(() => window.navigationCalls), []);
    assert.equal(await page.locator("#provider-error").textContent(), "");
    assert.equal(await page.locator("#provider-save").isDisabled(), false);
    assert.equal(await page.locator("#provider-name").inputValue(), "");
    assert.equal(await page.locator("#provider-url").inputValue(), "");
  }
  await page.locator("#private-space-toggle").click();
  await page.locator("#private-password").fill("wrong-password");
  await page.locator("#private-space-submit").click();
  assert.match(
    await page.locator("#private-space-error").innerText(),
    /chưa đúng/,
  );
  assert.equal(await page.locator("#private-password").inputValue(), "");
  await page.locator("#private-password").fill("fixture-password");
  await page.locator("#private-space-cancel").click();
  assert.equal(await page.locator("#private-password").inputValue(), "");
  assert.equal(await page.evaluate(() => window.fixture.commandOpen), false);
  assert.equal(await page.evaluate(() => window.fixture.panel), "service");
  await page.evaluate(() => {
    window.fixture.panel = "settings";
    window.emit();
  });
  await page.locator('[data-account-id="zalo"] .more-menu summary').click();
  await page
    .getByRole("button", {
      name: "Đưa tài khoản vào không gian kín",
      exact: true,
    })
    .click();
  await page.locator("#private-password").fill("fixture-password");
  await page.locator("#private-space-submit").click();
  await page.waitForFunction(
    () => !document.getElementById("private-space-dialog").open,
  );
  assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), {
    action: "unlock",
    data: { password: "fixture-password", accountId: "zalo", private: true },
  });
  assert.equal(
    await page.evaluate(() =>
      window.calls.some((call) => call.action === "membership"),
    ),
    false,
  );
  await page.evaluate(() => {
    window.fixture.accounts = [];
    window.fixture.active = "";
    window.fixture.panel = "welcome";
    window.emit();
  });
  assert.equal(await page.locator("#account-select").isDisabled(), true);
  assert.equal(
    await page.locator("#account-select-label").innerText(),
    "Chọn tài khoản",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS private UI: exclusive empty workspace, 940px toolbar, panel-preserving password dialog, atomic authenticated transfer, transition scrubbing, stale website result isolation, private notification/import exclusion, incorrect password and cancellation",
  );
} finally {
  await browser.close();
}
