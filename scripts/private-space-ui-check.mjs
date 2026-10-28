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
  const page = await browser.newPage({ bypassCSP: true });
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
      panel: "welcome",
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
        lockVersion: window.fixture.privateSpace.lockVersion,
        retryAt: 0,
      };
      window.fixture.accounts = [ordinary, secret];
      window.fixture.providers = [standard, hidden];
      window.fixture.providerTabs.open = ["zalo", "web_secret"];
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
      window.fixture.panel = "welcome";
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
  assert.equal(
    await page.evaluate(() =>
      document.body.innerHTML.includes("SECRET_FIXTURE"),
    ),
    false,
  );
  assert.equal(await page.locator("#command-results").innerText(), "");
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
    "PASS private UI: lock before first unlock, setup confirmation, password scrubbing, private notification/import exclusion, lock DOM cleanup, incorrect password, cancellation, empty accounts",
  );
} finally {
  await browser.close();
}
