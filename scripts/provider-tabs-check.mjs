import { nativeHeaderChoice } from "./native-menu-fixture.mjs";
// Run after `npm run build`. All pages and data are isolated fixtures. The
// built-in services are synthetic and custom sites use an ephemeral HTTP server.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  access,
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
import sharp from "sharp";

const project = fileURLToPath(new URL("..", import.meta.url));
const output = join(project, "outputs/provider-tabs");
const entry = join(project, "dist/main.cjs");
await access(entry);
const root = await mkdtemp(join(tmpdir(), "gom-provider-tabs-"));
const profile = join(root, "TinNhanDesktop");
const bootstrap = join(root, "bootstrap.cjs");
const cases = [];
const errors = [];
const requests = new Map();
const regression = process.argv
  .find((arg) => arg.startsWith("--regression="))
  ?.split("=")[1];
let client;
let page;
let failure;
let restartEvidence;

const fixtureHTML = `<!doctype html><html lang="vi" data-provider-tabs-fixture="true"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Website kiểm thử riêng</title><style>
:root{font:15px -apple-system,BlinkMacSystemFont,sans-serif;color:#173330;background:#f3f7f6}body{padding:35px}h1{font-size:24px}textarea{display:block;width:min(600px,80%);height:80px;margin:24px 0;padding:12px}.fixture-note{font-size:12px;color:#56716b}.probe{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}
</style></head><body><h1>Website kiểm thử cục bộ</h1><p>Hồ sơ tạm, không có tài khoản thật.</p><textarea id="draft" aria-label="Bản nháp kiểm thử"></textarea><p class="fixture-note">TRANG GIẢ LẬP · KHÔNG GỬI DỮ LIỆU RA NGOÀI</p><input id="contact-search-input" class="probe"><div class="chatlist probe"><a data-peer-id="fixture"></a></div><button class="probe" aria-label="New message">New message</button><script>document.documentElement.dataset.documentToken=crypto.randomUUID();</script></body></html>`;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://fixture.invalid").pathname;
  requests.set(path, (requests.get(path) ?? 0) + 1);
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(fixtureHTML);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

await mkdir(profile, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(
  join(profile, "window.json"),
  JSON.stringify({
    active: "zalo",
    activeAccount: "zalo",
    bounds: { width: 1280, height: 800 },
    preferences: { paused: false, shortcut: false, updateChecks: false },
  }),
);
await writeFile(
  bootstrap,
  `const e=require('electron');
const root=${JSON.stringify(root)};
e.app.setPath('appData',root);
require('node:os').homedir=()=>root;
globalThis.providerTabsFixture={sessions:new Map(),menu:null,desktop:null,external:[],blocked:[]};
const fixture=globalThis.providerTabsFixture;
e.shell.openExternal=async url=>{fixture.external.push(url);throw Error('Unexpected external navigation');};
e.dialog.showMessageBox=async()=>({response:1});
const handle=e.ipcMain.handle.bind(e.ipcMain);
e.ipcMain.handle=(channel,listener)=>{if(channel==='desktop')fixture.desktop=listener;return handle(channel,listener);};
// Keep the production Menu items and callbacks, replacing only the OS popup so
// choices can be asserted deterministically above the native service view.
e.Menu.prototype.popup=function(options){
  if(fixture.menu)throw Error('A native popup is already captured');
  fixture.menu={menu:this,options};
};
const partition=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{
  const ses=partition(...args);
  if(!fixture.sessions.has(ses)){
    fixture.sessions.set(ses,args[0]);
    ses.webRequest.onBeforeRequest((details,callback)=>{
      const url=new URL(details.url);
      const allowed=url.origin===${JSON.stringify(origin)}||url.protocol==='https:'&&['chat.zalo.me','web.telegram.org','www.facebook.com','mail.google.com','www.instagram.com','discord.com','slack.com','tinder.com'].includes(url.hostname);
      if(!allowed)fixture.blocked.push(details.url);
      callback({cancel:!allowed});
    });
    ses.protocol.handle('https',()=>new Response(${JSON.stringify(fixtureHTML)},{headers:{'content-type':'text/html; charset=utf-8'}}));
  }
  return ses;
};
require(${JSON.stringify(entry)});
`,
);

const state = () => page.evaluate(() => window.desktop.state());
const partitionFor = (id) =>
  ["zalo", "telegram", "messenger"].includes(id)
    ? `persist:${id}`
    : `persist:tn-account-${id}`;

async function eventually(label, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw Error(`Timed out: ${label}`);
}
async function launch() {
  client = await _electron.launch({
    executablePath: join(
      project,
      "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    ),
    args: ["--use-mock-keychain", bootstrap],
    timeout: 25_000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(
    () => typeof window.desktop?.addProvider === "function",
  );
  await client.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });
}
async function quit() {
  const process = client.process();
  const exited = new Promise((resolve) => process.once("exit", resolve));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
  client = undefined;
  page = undefined;
}
async function views() {
  return client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.filter((view) =>
        globalThis.providerTabsFixture.sessions.has(view.webContents.session),
      )
      .map((view) => ({
        id: view.webContents.id,
        partition: globalThis.providerTabsFixture.sessions.get(
          view.webContents.session,
        ),
        url: view.webContents.getURL(),
        visible: view.getVisible(),
        bounds: view.getBounds(),
      })),
  );
}
async function remote(accountId, code) {
  return client.evaluate(
    async ({ BrowserWindow }, { partition, code }) => {
      const fixture = globalThis.providerTabsFixture;
      const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
        (item) => fixture.sessions.get(item.webContents.session) === partition,
      );
      if (!view) throw Error(`Missing fixture account ${partition}`);
      return view.webContents.executeJavaScript(code);
    },
    { partition: partitionFor(accountId), code },
  );
}
async function active(accountId) {
  await eventually(`active fixture ${accountId}`, async () => {
    const current = await state();
    const visible = (await views()).filter((view) => view.visible);
    if (
      current.active !== accountId ||
      current.panel !== "service" ||
      visible.length !== 1 ||
      visible[0].partition !== partitionFor(accountId)
    )
      return false;
    return remote(
      accountId,
      "document.documentElement.dataset.providerTabsFixture==='true'",
    ).catch(() => false);
  });
  const current = await state();
  const provider = current.accounts.find(
    (account) => account.id === accountId,
  ).provider;
  const tab = page.locator(`#platform-${provider}`);
  await tab.waitFor({ state: "visible" });
  assert.equal(await tab.getAttribute("aria-selected"), "true");
  assert.equal((await views()).find((view) => view.visible).bounds.y, 52);
}
async function openLibrary() {
  if ((await state()).panel !== "providers")
    await nativeHeaderChoice(
      client,
      page,
      "header-add-provider",
      "#provider-add",
    );
  await page.locator("#providers-panel").waitFor({ state: "visible" });
  await eventually(
    "provider library panel",
    async () => (await state()).panel === "providers",
  );
  assert.equal(
    (await views()).filter((view) => view.visible).length,
    0,
    "Library is never obscured by native views",
  );
  await page.locator("#provider-search").fill("");
}
async function addThroughUI(name, path) {
  await openLibrary();
  await page.locator("#provider-name").fill(name);
  await page.locator("#provider-url").fill(origin + path);
  await page.locator("#provider-save").click();
  let provider;
  await eventually(`custom provider ${name}`, async () => {
    provider = (await state()).providers.find(
      (item) => item.entry === origin + path,
    );
    return !!provider;
  });
  const account = (await state()).accounts.find(
    (item) => item.provider === provider.id,
  );
  assert.ok(provider.custom);
  assert.match(provider.id, /^web_/);
  assert.match(account.id, /^acc_/);
  await active(account.id);
  return { provider, account };
}
async function reopen(providerId, accountId) {
  await openLibrary();
  await page.locator(`[data-provider-open="${providerId}"]`).click();
  await active(accountId);
}
async function setStorage(accountId, value) {
  await remote(
    accountId,
    `localStorage.setItem('provider-tabs-marker',${JSON.stringify(value)});document.cookie='provider-tabs-marker='+${JSON.stringify(value)}+'; path=/; max-age=86400';true`,
  );
}
async function storage(accountId) {
  return remote(
    accountId,
    `({local:localStorage.getItem('provider-tabs-marker'),cookie:document.cookie.split('; ').find(value=>value.startsWith('provider-tabs-marker='))?.split('=')[1]??null})`,
  );
}
async function menu() {
  await eventually("native provider menu", () =>
    client.evaluate(() => !!globalThis.providerTabsFixture.menu),
  );
  return client.evaluate(() => {
    const { menu, options } = globalThis.providerTabsFixture.menu;
    const items = (menu) =>
      menu.items.map((item) => ({
        id: item.id,
        label: item.label,
        type: item.type,
        checked: item.checked,
        enabled: item.enabled,
        submenu: item.submenu ? items(item.submenu) : [],
      }));
    return { items: items(menu), x: options.x, y: options.y };
  });
}
async function finishMenu(id) {
  await client.evaluate(({ BrowserWindow }, id) => {
    const captured = globalThis.providerTabsFixture.menu;
    if (!captured) throw Error("Missing captured menu");
    globalThis.providerTabsFixture.menu = null;
    if (id) {
      const item = captured.menu.getMenuItemById(id);
      if (!item) throw Error(`Missing menu item ${id}`);
      item.click(item, BrowserWindow.getAllWindows()[0], {});
    }
    captured.options.callback?.();
  }, id);
}
async function geometry(label) {
  const measured = await page.evaluate(() => {
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    const shown = (node) =>
      !!node.getClientRects().length &&
      !node.hidden &&
      getComputedStyle(node).visibility !== "hidden";
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tabs: [...document.querySelectorAll(".provider-tab")]
        .filter(shown)
        .map((node) => ({ provider: node.dataset.provider, box: rect(node) })),
      controls: ["provider-add", "provider-overflow", "account-select"]
        .map((id) => document.getElementById(id))
        .filter(shown)
        .map((node) => ({ id: node.id, box: rect(node) })),
    };
  });
  assert.ok(
    measured.scrollWidth <= measured.width + 1,
    `${label}: no horizontal document overflow`,
  );
  for (const { box } of [...measured.tabs, ...measured.controls]) {
    assert.ok(
      box.width > 0 && box.left >= 0 && box.right <= measured.width + 1,
      `${label}: all header controls fit`,
    );
    assert.ok(
      box.top >= 0 && box.bottom <= 52,
      `${label}: controls stay within 52px header`,
    );
  }
  for (let index = 1; index < measured.tabs.length; index++)
    assert.ok(
      measured.tabs[index - 1].box.right <= measured.tabs[index].box.left + 1,
      `${label}: tab hit areas do not overlap`,
    );
  return measured;
}
async function capture(name, native = false) {
  const shell = await page.screenshot();
  if (!native) {
    await writeFile(join(output, name), shell);
    return;
  }
  // Playwright's shell capture excludes WebContentsView. Composite the actual
  // visible fixture surface so review images show the app as it was displayed.
  const child = await client.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
      (view) => view.getVisible(),
    );
    if (!view) throw Error("No visible native surface to capture");
    return {
      bounds: view.getBounds(),
      png: (await view.webContents.capturePage()).toPNG().toString("base64"),
    };
  });
  const width = await page.evaluate(() => innerWidth);
  const scale = (await sharp(shell).metadata()).width / width;
  const nativeImage = await sharp(Buffer.from(child.png, "base64"))
    .resize(
      Math.round(child.bounds.width * scale),
      Math.round(child.bounds.height * scale),
    )
    .toBuffer();
  await sharp(shell)
    .composite([
      {
        input: nativeImage,
        left: Math.round(child.bounds.x * scale),
        top: Math.round(child.bounds.y * scale),
      },
    ])
    .toFile(join(output, name));
}
async function check(name, action) {
  await action();
  cases.push(name);
  console.log(`PASS ${name}`);
}

async function customContents(provider) {
  const accounts = (await state()).accounts.filter(
    (account) => account.provider === provider,
  );
  return client.evaluate(
    ({ webContents }, partitions) =>
      webContents
        .getAllWebContents()
        .filter((contents) =>
          partitions.includes(
            globalThis.providerTabsFixture.sessions.get(contents.session),
          ),
        )
        .map((contents) => ({ id: contents.id, url: contents.getURL() })),
    accounts.map((account) => partitionFor(account.id)),
  );
}
async function closedNavigation() {
  const custom = await addThroughUI(
    "Closed navigation fixture",
    "/closed-navigation",
  );
  for (const provider of (await state()).providerTabs.open.filter(
    (id) => id !== custom.provider.id,
  ))
    assert.equal(
      (await page.evaluate((id) => window.desktop.closeProvider(id), provider))
        .ok,
      true,
    );
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.closeProvider(id),
        custom.provider.id,
      )
    ).ok,
    true,
  );
  assert.equal((await state()).panel, "providers");
  assert.deepEqual(await customContents(custom.provider.id), []);
  const effects = [];
  for (const command of ["reload", "home", "back"]) {
    await page.evaluate((command) => window.desktop[command](), command);
    effects.push({
      command: `IPC ${command}`,
      contents: await customContents(custom.provider.id),
    });
  }
  for (const label of ["Tải lại nền tảng", "Trang đầu nền tảng", "Quay lại"]) {
    await client.evaluate(({ Menu, BrowserWindow }, label) => {
      const find = (menu) => {
        for (const item of menu.items) {
          if (item.label === label) return item;
          const nested = item.submenu && find(item.submenu);
          if (nested) return nested;
        }
      };
      const item = find(Menu.getApplicationMenu());
      if (!item) throw Error(`Missing native navigation menu ${label}`);
      item.click(item, BrowserWindow.getAllWindows()[0], {});
    }, label);
    effects.push({
      command: `Menu ${label}`,
      contents: await customContents(custom.provider.id),
    });
  }
  assert.equal((await state()).panel, "providers");
  assert.deepEqual(
    effects,
    effects.map(({ command }) => ({ command, contents: [] })),
    "Navigation commands cannot recreate a closed custom view",
  );
  await reopen(custom.provider.id, custom.account.id);
  assert.equal(
    (await views()).filter((view) => view.visible).length,
    1,
    "Reopened custom view is attached and visible",
  );
}
async function settingsClose() {
  await page.evaluate(() => window.desktop.activateProvider("zalo"));
  const custom = await addThroughUI(
    "Settings close fixture",
    "/settings-close",
  );
  await page.evaluate(() => window.desktop.settings());
  await page.locator("#settings-panel").waitFor({ state: "visible" });
  await nativeHeaderChoice(
    client,
    page,
    "provider-close",
    `#platform-${custom.provider.id}`,
    "right",
  );
  await eventually(
    "close custom from Settings",
    async () => !(await state()).providerTabs.open.includes(custom.provider.id),
  );
  await page.locator("#close-settings").click();
  await eventually(
    "return from Settings",
    async () => (await state()).panel === "service",
  );
  const current = await state();
  assert.equal(
    current.providerTabs.open.includes(custom.provider.id),
    false,
    "Returning from Settings must not reopen the tab just closed",
  );
  assert.notEqual(
    current.accounts.find((account) => account.id === current.active).provider,
    custom.provider.id,
  );
  await active(current.active);
}
async function lazyRestore() {
  const custom = await addThroughUI("Lazy restore fixture", "/lazy-restore");
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.closeProvider(id),
        custom.provider.id,
      )
    ).ok,
    true,
  );
  await page.evaluate(() => window.desktop.settings());
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.archiveAccount(id),
        custom.account.id,
      )
    ).ok,
    true,
  );
  assert.deepEqual(await customContents(custom.provider.id), []);
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.restoreAccount(id),
        custom.account.id,
      )
    ).ok,
    true,
  );
  assert.equal((await state()).panel, "settings");
  assert.deepEqual(
    await customContents(custom.provider.id),
    [],
    "Restoring a closed custom account must not load its website",
  );
  assert.equal(
    (await state()).providerTabs.open.includes(custom.provider.id),
    false,
  );
  await reopen(custom.provider.id, custom.account.id);
}
async function emptySettingsBack() {
  const custom = await addThroughUI(
    "Empty Settings Back fixture",
    "/empty-settings-back",
  );
  const order = [
    ...(await state()).providerTabs.open.filter(
      (id) => id !== custom.provider.id,
    ),
    custom.provider.id,
  ];
  for (const id of order)
    assert.equal(
      (await page.evaluate((id) => window.desktop.closeProvider(id), id)).ok,
      true,
    );
  assert.deepEqual((await state()).providerTabs, { open: [], pinned: [] });
  assert.equal((await state()).panel, "providers");
  assert.deepEqual(await customContents(custom.provider.id), []);
  await nativeHeaderChoice(client, page, "header-settings");
  await page.locator("#settings-panel").waitFor({ state: "visible" });
  await page.locator("#close-settings").click();
  await eventually(
    "leave Settings with no open tabs",
    async () => (await state()).panel !== "settings",
  );
  const current = await state();
  assert.deepEqual(
    current.providerTabs,
    { open: [], pinned: [] },
    "Settings Back must not reopen a tab when all tabs are closed",
  );
  assert.equal(current.panel, "providers");
  await page.locator("#providers-panel").waitFor({ state: "visible" });
  assert.deepEqual(
    await customContents(custom.provider.id),
    [],
    "Settings Back must not reload a closed custom website",
  );
  assert.equal((await views()).filter((view) => view.visible).length, 0);
}
async function archivedProviderBack() {
  const archived = await addThroughUI(
    "Archived Back fixture",
    "/archived-provider-back",
  );
  for (const id of (await state()).providerTabs.open.filter(
    (id) => id !== archived.provider.id,
  ))
    assert.equal(
      (await page.evaluate((id) => window.desktop.closeProvider(id), id)).ok,
      true,
    );
  await nativeHeaderChoice(client, page, "header-settings");
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.archiveAccount(id),
        archived.account.id,
      )
    ).ok,
    true,
  );
  assert.deepEqual(
    (await state()).providerTabs.open,
    [],
    "Archiving the last account removes its open tab",
  );
  await page.locator("#close-settings").click();
  const unavailable = await state();
  await page.waitForFunction(
    (panel) =>
      document.getElementById("providers-panel").hidden ===
      (panel !== "providers"),
    unavailable.panel,
  );
  const firstOutcome = {
    panel: unavailable.panel,
    open: unavailable.providerTabs.open,
    customContents: await customContents(archived.provider.id),
    libraryBackHidden: await page
      .locator("#close-providers")
      .evaluate((button) => button.hidden),
  };
  const usable = await addThroughUI(
    "Usable later Back fixture",
    "/usable-provider-back",
  );
  await nativeHeaderChoice(client, page, "header-settings");
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.closeProvider(id),
        usable.provider.id,
      )
    ).ok,
    true,
  );
  await page.evaluate(() => window.desktop.activateProvider("zalo"));
  await nativeHeaderChoice(client, page, "header-settings");
  assert.equal(
    (await page.evaluate(() => window.desktop.closeProvider("zalo"))).ok,
    true,
  );
  await page.evaluate(
    (id) => window.desktop.pinProvider(id),
    usable.provider.id,
  );
  await nativeHeaderChoice(client, page, "header-settings");
  await page.locator("#settings-panel").waitFor({ state: "visible" });
  const before = await state();
  assert.deepEqual(before.providerTabs.open, [usable.provider.id]);
  assert.equal(
    before.providerTabs.open.includes(
      before.accounts.find((account) => account.id === before.active).provider,
    ),
    true,
    "Pinning the only usable tab selects an account from that open provider",
  );
  await page.locator("#close-settings").click();
  const available = await state();
  const secondOutcome = {
    panel: available.panel,
    provider: available.accounts.find(
      (account) => account.id === available.active,
    ).provider,
    open: available.providerTabs.open,
  };
  assert.deepEqual(
    { unavailable: firstOutcome, laterUsable: secondOutcome },
    {
      unavailable: {
        panel: "providers",
        open: [],
        customContents: [],
        libraryBackHidden: true,
      },
      laterUsable: {
        panel: "service",
        provider: usable.provider.id,
        open: [usable.provider.id],
      },
    },
    "Archived providers leave open tabs and library Back stays hidden until a usable tab exists",
  );
  await active(usable.account.id);
  assert.deepEqual(await customContents(archived.provider.id), []);
}

try {
  await launch();
  if (regression) {
    const checks = {
      "closed-navigation": closedNavigation,
      "settings-close": settingsClose,
      "lazy-restore": lazyRestore,
      "empty-settings-back": emptySettingsBack,
      "archived-provider-back": archivedProviderBack,
    };
    assert.ok(checks[regression], `Unknown regression ${regression}`);
    await check(regression, checks[regression]);
  } else {
    let first, second, secondAccount;
    const extras = [];
    await check(
      "isolated profile retains built-ins and mock keychain",
      async () => {
        assert.equal(
          await client.evaluate(({ app }) => app.getPath("userData")),
          profile,
        );
        assert.equal(
          await client.evaluate(({ app }) =>
            app.commandLine.hasSwitch("use-mock-keychain"),
          ),
          true,
        );
        assert.deepEqual((await state()).profiles, []);
        assert.deepEqual(
          (await state()).providers.map((provider) => provider.id),
          [
            "zalo",
            "telegram",
            "messenger",
            "gmail",
            "instagram",
            "discord",
            "slack",
            "tinder",
          ],
        );
        await page.evaluate(() => window.desktop.activate("zalo"));
        await active("zalo");
      },
    );

    await check(
      "real library form adds a custom website with an isolated account",
      async () => {
        first = await addThroughUI(
          "Website Công việc kiểm thử rất dài",
          "/primary",
        );
        assert.ok(
          (await state()).providerTabs.open.includes(first.provider.id),
        );
        assert.equal((await state()).unread[first.account.id].count, null);
        assert.equal(
          (await state()).unread[first.account.id].source,
          "unavailable",
        );
        await setStorage(first.account.id, "primary-personal");
        await openLibrary();
        await page.locator("#provider-search").fill("cong viec");
        assert.equal(
          await page
            .locator(`[data-provider-open="${first.provider.id}"]`)
            .isVisible(),
          true,
        );
        assert.equal(
          await page.locator('[data-provider-open="telegram"]').isVisible(),
          false,
        );
        await page
          .locator(`[data-provider-open="${first.provider.id}"]`)
          .click();
        await active(first.account.id);
      },
    );

    await check(
      "privileged URLs are rejected without catalog mutation",
      async () => {
        const before = (await state()).providers;
        for (const url of [
          "javascript:alert(1)",
          "file:///etc/passwd",
          "https://user:secret@example.test/",
          "http://bad_host/",
        ]) {
          const result = await page.evaluate(
            (url) => window.desktop.addProvider("Invalid fixture", url),
            url,
          );
          assert.equal(result.ok, false, url);
        }
        assert.deepEqual((await state()).providers, before);
      },
    );

    await check(
      "custom website cannot access the shell bridge or privileged IPC",
      async () => {
        assert.deepEqual(
          await remote(
            first.account.id,
            "({desktop:typeof window.desktop,require:typeof require,process:typeof process})",
          ),
          { desktop: "undefined", require: "undefined", process: "undefined" },
        );
        const result = await client.evaluate(
          async ({ BrowserWindow }, partition) => {
            const fixture = globalThis.providerTabsFixture;
            const view =
              BrowserWindow.getAllWindows()[0].contentView.children.find(
                (item) =>
                  fixture.sessions.get(item.webContents.session) === partition,
              );
            const outcomes = [];
            for (const command of [
              "state",
              "activate-provider",
              "provider-add",
              "account-add",
            ]) {
              try {
                await fixture.desktop(
                  {
                    sender: view.webContents,
                    senderFrame: view.webContents.mainFrame,
                  },
                  command,
                  {},
                );
                outcomes.push("allowed");
              } catch (error) {
                outcomes.push(error.message);
              }
            }
            return outcomes;
          },
          partitionFor(first.account.id),
        );
        assert.deepEqual(result, [
          "untrusted",
          "untrusted",
          "untrusted",
          "untrusted",
        ]);
      },
    );

    await check(
      "accounts and custom providers on the same origin have separate cookies and storage",
      async () => {
        await nativeHeaderChoice(
          client,
          page,
          "header-add-account",
          "#provider-add",
        );
        await page.locator("#account-editor").waitFor({ state: "visible" });
        await page.locator("#account-provider").selectOption(first.provider.id);
        await page.locator("#account-name").fill("Công việc riêng");
        await page.locator("#account-editor-save").click();
        await eventually("second custom account", async () => {
          secondAccount = (await state()).accounts.find(
            (account) =>
              account.provider === first.provider.id &&
              account.id !== first.account.id,
          );
          return !!secondAccount;
        });
        await active(secondAccount.id);
        assert.deepEqual(await storage(secondAccount.id), {
          local: null,
          cookie: null,
        });
        await setStorage(secondAccount.id, "primary-work");
        second = await addThroughUI("Website thứ hai", "/secondary");
        assert.deepEqual(await storage(second.account.id), {
          local: null,
          cookie: null,
        });
        await setStorage(second.account.id, "secondary-personal");
        await page.evaluate(
          (id) => window.desktop.activate(id),
          first.account.id,
        );
        await active(first.account.id);
        assert.deepEqual(await storage(first.account.id), {
          local: "primary-personal",
          cookie: "primary-personal",
        });
        await page.evaluate(
          (id) => window.desktop.activate(id),
          secondAccount.id,
        );
        await active(secondAccount.id);
        assert.deepEqual(await storage(secondAccount.id), {
          local: "primary-work",
          cookie: "primary-work",
        });
      },
    );

    await check(
      "library pinning produces compact tabs and closing preserves accounts and login data",
      async () => {
        await openLibrary();
        const pin = page.locator(`[data-provider-pin="${first.provider.id}"]`);
        await pin.click();
        await eventually("provider pinned", async () =>
          (await state()).providerTabs.pinned.includes(first.provider.id),
        );
        assert.equal(await pin.getAttribute("aria-pressed"), "true");
        assert.ok(
          await page
            .locator(`.provider-tab[data-provider="${first.provider.id}"]`)
            .evaluate((node) => node.classList.contains("is-pinned")),
        );
        await page
          .locator(`#platform-${first.provider.id}`)
          .click({ button: "right" });
        const pinMenu = await menu();
        assert.ok(
          pinMenu.items.some((item) => item.id === "provider-pin"),
          JSON.stringify(pinMenu),
        );
        assert.equal(
          pinMenu.items.find((item) => item.id === "provider-pin").label,
          "Bỏ ghim tab",
        );
        await finishMenu("provider-pin");
        await eventually(
          "provider unpinned",
          async () =>
            !(await state()).providerTabs.pinned.includes(first.provider.id),
        );
        await page
          .locator(`[data-provider-open="${first.provider.id}"]`)
          .click();
        await active(secondAccount.id);
        const ids = (await state()).accounts.map((account) => account.id);
        await nativeHeaderChoice(
          client,
          page,
          "provider-close",
          `#platform-${first.provider.id}`,
          "right",
        );
        await eventually(
          "custom tab closed",
          async () =>
            !(await state()).providerTabs.open.includes(first.provider.id),
        );
        assert.deepEqual(
          (await state()).accounts.map((account) => account.id),
          ids,
        );
        assert.ok(
          (await state()).providers.some(
            (provider) => provider.id === first.provider.id,
          ),
        );
        await reopen(first.provider.id, secondAccount.id);
        assert.deepEqual(await storage(secondAccount.id), {
          local: "primary-work",
          cookie: "primary-work",
        });
        await page.evaluate(
          (id) => window.desktop.activate(id),
          first.account.id,
        );
        await active(first.account.id);
        assert.deepEqual(await storage(first.account.id), {
          local: "primary-personal",
          cookie: "primary-personal",
        });
      },
    );

    await check(
      "many long-name tabs overflow into a native menu with every hidden tab reachable",
      async () => {
        for (let index = 0; index < 14; index++) {
          const result = await page.evaluate(
            ({ name, url }) => window.desktop.addProvider(name, url),
            {
              name: `Website ${index + 1} với tên kiểm thử rất dài`,
              url: `${origin}/extra-${index}`,
            },
          );
          assert.equal(result.ok, true);
          extras.push(result);
          await active(result.accountId);
        }
        await client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(940, 700),
        );
        await page.waitForFunction(() => innerWidth === 940);
        await page.locator("#provider-overflow").waitFor({ state: "visible" });
        await geometry("many ordinary tabs");
        await capture("mixed-tabs-940.png", true);
        const current = await state();
        const shown = await page
          .locator(".provider-tab")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => !!node.getClientRects().length && !node.hidden)
              .map((node) => node.dataset.provider),
          );
        const hidden = current.providerTabs.open.filter(
          (id) => !shown.includes(id),
        );
        assert.ok(hidden.length > 0);
        assert.ok(
          shown.includes(extras.at(-1).providerId),
          "Active tab is always visible",
        );
        await page.locator("#provider-overflow").click();
        const popup = await menu();
        const providerItems = popup.items.filter(
          (item) => item.type === "radio",
        );
        assert.deepEqual(
          providerItems.map((item) => item.id.replace(/^provider-/, "")).sort(),
          hidden.slice().sort(),
        );
        for (const item of providerItems) assert.equal(item.enabled, true);
        const target = hidden.at(-1);
        await finishMenu(`provider-${target}`);
        await eventually("overflow selection", async () => {
          const current = await state();
          return (
            current.accounts.find((account) => account.id === current.active)
              ?.provider === target
          );
        });
        const selected = await state();
        await active(selected.active);
        for (const id of selected.providerTabs.open)
          await page.evaluate((id) => window.desktop.pinProvider(id), id);
        await geometry("many pinned tabs");
        await page.locator("#provider-overflow").waitFor({ state: "visible" });
        assert.equal(
          await page.locator(`#platform-${target}`).isVisible(),
          true,
        );
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => window.desktop.setTheme(theme), theme);
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            theme,
          );
          await capture(`${theme}-overflow-940.png`, true);
          await openLibrary();
          await page
            .locator("#providers-panel")
            .evaluate((panel) => (panel.scrollTop = 0));
          await capture(`${theme}-library-940.png`);
          await page.locator(`[data-provider-open="${target}"]`).click();
          await active(selected.active);
        }
        await page.evaluate(() => window.desktop.settings());
        await page.locator("#settings-tab-accounts").click();
        await page
          .locator("#account-provider-filter")
          .selectOption(first.provider.id);
        const filtered = await page
          .locator("#account-manager [data-provider]")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => !!node.getClientRects().length && !node.hidden)
              .map((node) => node.dataset.provider),
          );
        assert.deepEqual(filtered, [first.provider.id, first.provider.id]);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          "Settings filters fit with many providers",
        );
        await page.locator("#close-settings").click();
        await active(selected.active);
      },
    );

    await check(
      "closing all tabs opens the library and reopening keeps the last account",
      async () => {
        await page.evaluate(
          (id) => window.desktop.activate(id),
          secondAccount.id,
        );
        await active(secondAccount.id);
        for (const id of (await state()).providerTabs.open) {
          const result = await page.evaluate(
            (id) => window.desktop.closeProvider(id),
            id,
          );
          assert.equal(result.ok, true);
        }
        assert.deepEqual((await state()).providerTabs, {
          open: [],
          pinned: [],
        });
        assert.equal((await state()).panel, "providers");
        assert.equal((await views()).filter((view) => view.visible).length, 0);
        await reopen(first.provider.id, secondAccount.id);
        assert.deepEqual(await storage(secondAccount.id), {
          local: "primary-work",
          cookie: "primary-work",
        });
      },
    );

    await check(
      "registry, open tabs, pins, active account and isolated sessions survive restart",
      async () => {
        await page.evaluate(
          (id) => window.desktop.activateProvider(id),
          second.provider.id,
        );
        await active(second.account.id);
        await page.evaluate(
          (id) => window.desktop.activate(id),
          secondAccount.id,
        );
        await active(secondAccount.id);
        await page.evaluate(
          (id) => window.desktop.pinProvider(id),
          first.provider.id,
        );
        const before = await state();
        await quit();
        const catalog = JSON.parse(
          await readFile(join(profile, "accounts.json"), "utf8"),
        );
        const settings = JSON.parse(
          await readFile(join(profile, "window.json"), "utf8"),
        );
        assert.equal(catalog.version, 2);
        assert.equal(
          catalog.providers.length,
          before.providers.filter((provider) => provider.custom).length,
        );
        assert.deepEqual(settings.providerTabs, before.providerTabs);
        const previousRequests = Object.fromEntries(requests);
        await launch();
        assert.equal(
          (await state()).active,
          secondAccount.id,
          "Startup retains the selected account metadata before choosing it from Welcome",
        );
        await page.evaluate(
          (id) => window.desktop.activate(id),
          secondAccount.id,
        );
        await active(secondAccount.id);
        const after = await state();
        assert.deepEqual(after.providers, before.providers);
        assert.deepEqual(after.accounts, before.accounts);
        assert.deepEqual(after.providerTabs, before.providerTabs);
        assert.equal(after.active, secondAccount.id);
        assert.deepEqual(await storage(secondAccount.id), {
          local: "primary-work",
          cookie: "primary-work",
        });
        // Observe the ordinary startup interval as well as the first paint; dormant
        // custom providers must not be preloaded just because they are registered.
        await page.waitForTimeout(1200);
        for (let index = 0; index < extras.length; index++)
          assert.equal(
            requests.get(`/extra-${index}`),
            previousRequests[`/extra-${index}`],
            `Closed website ${index} must not load at startup`,
          );
        assert.ok(
          !(await views()).some(
            (view) => view.partition === partitionFor(second.account.id),
          ),
          "Inactive custom providers load lazily, even with an open tab",
        );
        restartEvidence = {
          providerCount: after.providers.length,
          tabs: after.providerTabs,
          active: after.active,
          views: await views(),
          requests: Object.fromEntries(requests),
        };
        await page.evaluate(
          (id) => window.desktop.activate(id),
          first.account.id,
        );
        await active(first.account.id);
        assert.deepEqual(await storage(first.account.id), {
          local: "primary-personal",
          cookie: "primary-personal",
        });
        await page.evaluate(
          (id) => window.desktop.activateProvider(id),
          second.provider.id,
        );
        await active(second.account.id);
        assert.deepEqual(await storage(second.account.id), {
          local: "secondary-personal",
          cookie: "secondary-personal",
        });
      },
    );

    await check(
      "empty open-tab state also persists without reopening a custom website",
      async () => {
        for (const id of (await state()).providerTabs.open)
          assert.equal(
            (await page.evaluate((id) => window.desktop.closeProvider(id), id))
              .ok,
            true,
          );
        await quit();
        const before = Object.fromEntries(requests);
        await launch();
        assert.deepEqual((await state()).providerTabs, {
          open: [],
          pinned: [],
        });
        await openLibrary();
        assert.deepEqual((await state()).providerTabs, {
          open: [],
          pinned: [],
        });
        assert.equal((await state()).panel, "providers");
        await page.waitForTimeout(500);
        assert.deepEqual(Object.fromEntries(requests), before);
        assert.equal((await views()).filter((view) => view.visible).length, 0);
      },
    );
    await check(
      "closed-tab IPC and native navigation do not create detached custom views",
      closedNavigation,
    );
    await check(
      "closing the active tab in Settings selects an existing open tab on return",
      settingsClose,
    );
    await check(
      "restoring a closed custom account stays lazy until activation",
      lazyRestore,
    );
    await check(
      "Settings Back returns to the library when all tabs are closed",
      emptySettingsBack,
    );
    await check(
      "Back skips archived-only providers and hides unusable library Back",
      archivedProviderBack,
    );
  }

  assert.deepEqual(errors, [], "No shell renderer exceptions");
  assert.deepEqual(
    await client.evaluate(() => globalThis.providerTabsFixture.external),
    [],
    "No external navigation",
  );
} catch (error) {
  failure = error.stack ?? String(error);
  if (page)
    await page
      .screenshot({ path: join(output, "failure.png") })
      .catch(() => {});
  throw error;
} finally {
  await writeFile(
    join(output, regression ? `${regression}-results.json` : "results.json"),
    JSON.stringify(
      {
        cases,
        errors,
        failure,
        restartEvidence,
        requests: Object.fromEntries(requests),
      },
      null,
      2,
    ),
  );
  if (client) await client.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
console.log(`Provider tab checks passed: ${output}`);
