// Isolated Electron fixture. No real QR, WhatsApp account or network requests.
// Run after `npm run build`.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import sharp from "sharp";

const project = fileURLToPath(new URL("..", import.meta.url));
const output = join(project, "outputs/whatsapp-web");
const root = await mkdtemp(join(tmpdir(), "gom-whatsapp-"));
const profile = join(root, "TinNhanDesktop");
const chrome = join(root, "Library/Application Support/Google/Chrome");
const bootstrap = join(root, "bootstrap.cjs");
const cases = [];
const errors = [];
let client;
let page;

const fixture = `<!doctype html><html lang="vi" data-whatsapp-fixture="true"><head><meta charset="utf-8"><title>WhatsApp</title><style>
body{margin:0;background:#f7f9f8;color:#19382d;font:15px -apple-system,sans-serif}main{max-width:620px;margin:70px auto;padding:32px;background:white;border:1px solid #dce5df;border-radius:16px}h1{font-size:25px}p{line-height:1.7}.note{font-size:12px;color:#647b70}canvas{display:block;background:#edf5f0;border:1px dashed #25a365;margin:24px 0}button,textarea{font:inherit;padding:10px}#side{padding:24px}#pane-side{min-height:140px}textarea{width:90%;height:70px}
</style></head><body><main><h1>WhatsApp · Liên kết thiết bị</h1><p>Màn hình giả lập để kiểm tra kết nối trong Gom.</p><canvas role="img" width="170" height="170" aria-label="Scan this QR code to link a device"></canvas><p class="note">DỮ LIỆU KIỂM THỬ · KHÔNG CÓ MÃ QR THẬT</p></main><script>document.documentElement.dataset.token=crypto.randomUUID();</script></body></html>`;
const authenticated = `<div id="side"><header><h1>WhatsApp · Kiểm thử</h1><button>New chat</button></header><div id="pane-side"><p>Danh sách trò chuyện giả lập.</p></div><textarea id="draft" aria-label="Bản nháp kiểm thử"></textarea></div><p class="note">DỮ LIỆU KIỂM THỬ · KHÔNG CÓ TÀI KHOẢN THẬT</p>`;

await mkdir(profile, { recursive: true });
await mkdir(chrome, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(
  join(chrome, "Local State"),
  JSON.stringify({
    profile: { info_cache: { Default: { name: "Fixture Chrome" } } },
  }),
);
await writeFile(
  join(profile, "window.json"),
  JSON.stringify({
    active: "zalo",
    activeAccount: "zalo",
    providerTabDefaultsVersion: 2,
    providerTabs: { open: ["zalo", "telegram", "messenger"], pinned: ["zalo"] },
    bounds: { width: 1200, height: 800 },
    preferences: { paused: true, shortcut: false, updateChecks: false },
  }),
);
await writeFile(
  bootstrap,
  `const e=require('electron');
e.app.setPath('appData',${JSON.stringify(root)});
require('node:os').homedir=()=>${JSON.stringify(root)};
globalThis.whatsappFixture={sessions:new Map(),external:[]};
e.shell.openExternal=async url=>{globalThis.whatsappFixture.external.push(url);throw Error('Unexpected external navigation');};
const fromPartition=e.session.fromPartition.bind(e.session);
e.session.fromPartition=(...args)=>{
 const session=fromPartition(...args);
 if(!globalThis.whatsappFixture.sessions.has(session)){
  globalThis.whatsappFixture.sessions.set(session,args[0]);
  session.protocol.handle('https',()=>new Response(${JSON.stringify(fixture)},{headers:{'content-type':'text/html; charset=utf-8'}}));
  session.protocol.handle('http',()=>new Response('Blocked fixture request',{status:403}));
 }
 return session;
};
require(${JSON.stringify(join(project, "dist/main.cjs"))});
`,
);

const state = () => page.evaluate(() => window.desktop.state());
const partition = (account) =>
  account === "whatsapp" ? "persist:whatsapp" : `persist:tn-account-${account}`;
async function eventually(label, predicate, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
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
    () => typeof window.desktop?.activateProvider === "function",
  );
}
async function quit() {
  const process = client.process();
  const exit = new Promise((resolve) => process.once("exit", resolve));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exit;
  client = undefined;
}
async function remote(account, code) {
  return client.evaluate(
    async ({ webContents }, { partition, code }) => {
      const sessions = globalThis.whatsappFixture.sessions;
      const contents = webContents
        .getAllWebContents()
        .find(
          (item) =>
            sessions.get(item.session) === partition &&
            item.getURL().startsWith("https://web.whatsapp.com/"),
        );
      if (!contents) throw Error(`Missing fixture view: ${partition}`);
      return contents.executeJavaScript(code);
    },
    { partition: partition(account), code },
  );
}
async function activate(account) {
  await page.evaluate((id) => window.desktop.activate(id), account);
  await eventually(`view for ${account}`, () =>
    remote(
      account,
      "document.documentElement.dataset.whatsappFixture==='true'",
    ).catch(() => false),
  );
  const visiblePartitions = await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.filter((view) => view.getVisible())
      .map((view) =>
        globalThis.whatsappFixture.sessions.get(view.webContents.session),
      ),
  );
  assert.deepEqual(visiblePartitions, [partition(account)]);
}
async function expectStatus(account, value) {
  await eventually(
    `${account} ${value}`,
    async () => (await state()).statuses[account] === value,
  );
}
async function capture(name) {
  const bytes = await client.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].capturePage())
      .toPNG()
      .toString("base64"),
  );
  const shell = Buffer.from(bytes, "base64");
  const child = await client.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
      (view) => view.getVisible(),
    );
    return view
      ? {
          bounds: view.getBounds(),
          png: (await view.webContents.capturePage())
            .toPNG()
            .toString("base64"),
        }
      : null;
  });
  if (!child) return writeFile(join(output, name), shell);
  // Electron's shell capture omits WebContentsView; composite its actual pixels.
  const scale =
    (await sharp(shell).metadata()).width /
    (await page.evaluate(() => innerWidth));
  const native = await sharp(Buffer.from(child.png, "base64"))
    .resize(
      Math.round(child.bounds.width * scale),
      Math.round(child.bounds.height * scale),
    )
    .toBuffer();
  await sharp(shell)
    .composite([
      {
        input: native,
        left: Math.round(child.bounds.x * scale),
        top: Math.round(child.bounds.y * scale),
      },
    ])
    .toFile(join(output, name));
}

try {
  await launch();
  assert.deepEqual((await state()).providerTabs, {
    open: ["zalo", "telegram", "messenger"],
    pinned: ["zalo"],
  });
  await page.evaluate(() => window.desktop.providerLibrary(true));
  await page.locator("#provider-search").fill("WhatsApp");
  const open = page.locator("#open-provider-whatsapp");
  await open.waitFor({ state: "visible" });
  const logo = open.locator("img");
  assert.match(await logo.getAttribute("src"), /whatsapp\.svg$/);
  await eventually("local logo loaded", () =>
    logo.evaluate((image) => image.complete && image.naturalWidth > 0),
  );
  await capture("catalog.png");
  await open.click();
  await activate("whatsapp");
  await expectStatus("whatsapp", "needs-login");
  assert.equal((await state()).unread.whatsapp.count, null);
  await capture("linking-fixture.png");
  cases.push(
    "Saved tab order/pins retained; WhatsApp search, local logo and device-linking status work.",
  );

  const marker = "synthetic-primary-session";
  await remote(
    "whatsapp",
    `localStorage.setItem('fixture-session',${JSON.stringify(marker)});document.body.innerHTML=${JSON.stringify(authenticated)};document.title='(3) WhatsApp';document.querySelector('#draft').value='Bản nháp kiểm thử';`,
  );
  await expectStatus("whatsapp", "authenticated");
  await eventually(
    "WhatsApp unread title",
    async () => (await state()).unread.whatsapp.count === 3,
  );
  const token = await remote(
    "whatsapp",
    "document.documentElement.dataset.token",
  );
  const added = await page.evaluate(() =>
    window.desktop.addAccount("whatsapp", "Công việc", "CV"),
  );
  assert.equal(added.ok, true);
  await activate(added.accountId);
  await expectStatus(added.accountId, "needs-login");
  assert.equal(
    await remote(added.accountId, "localStorage.getItem('fixture-session')"),
    null,
  );
  await remote(
    added.accountId,
    "localStorage.setItem('fixture-session','synthetic-second-session')",
  );
  await activate("whatsapp");
  assert.equal(
    await remote("whatsapp", "document.documentElement.dataset.token"),
    token,
  );
  assert.equal(
    await remote("whatsapp", "document.querySelector('#draft').value"),
    "Bản nháp kiểm thử",
  );
  cases.push(
    "Signed-in fixture and unread counter update; two accounts are isolated and switching retains the document/draft.",
  );

  await page.evaluate(() => window.desktop.settings());
  await page.locator(".import-section summary").click();
  const target = page.locator("#import-target");
  await eventually(
    "Chrome fixture profile",
    async () => (await state()).profiles.length === 1,
  );
  // Change the destination in the renderer; it must update without a state poll.
  await target.selectOption("messenger");
  assert.equal(await page.locator("#import").isEnabled(), true);
  await target.selectOption("whatsapp");
  assert.equal(await page.locator("#import").isEnabled(), false);
  assert.equal(
    await page.locator("#import-hint").textContent(),
    "Mở WhatsApp trong Gom và liên kết thiết bị trên điện thoại.",
  );
  const before = await remote(
    "whatsapp",
    "localStorage.getItem('fixture-session')",
  );
  const result = await page.evaluate(() =>
    window.desktop.importSession("Default", "whatsapp"),
  );
  assert.equal(result.status, "unsupported-session");
  assert.equal(
    await remote("whatsapp", "localStorage.getItem('fixture-session')"),
    before,
  );
  assert.equal((await state()).importing, false);
  cases.push(
    "Destination changes immediately update import guidance; direct WhatsApp import is rejected without touching its session.",
  );

  await activate("whatsapp");
  await quit();
  await rm(join(chrome, "Local State"));
  await launch();
  await activate("whatsapp");
  assert.equal(
    await remote("whatsapp", "localStorage.getItem('fixture-session')"),
    marker,
  );
  await activate(added.accountId);
  assert.equal(
    await remote(added.accountId, "localStorage.getItem('fixture-session')"),
    "synthetic-second-session",
  );
  await page.evaluate(() => window.desktop.settings());
  await page.locator(".import-section summary").click();
  await page.locator("#import-target").selectOption(added.accountId);
  assert.equal((await state()).profiles.length, 0);
  assert.equal(await page.locator("#import").isEnabled(), false);
  assert.equal(
    await page.locator("#import-hint").textContent(),
    "Mở WhatsApp trong Gom và liên kết thiết bị trên điện thoại.",
  );
  cases.push(
    "Both synthetic sessions survive full app restart; WhatsApp linking guidance works without Chrome profiles.",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    await client.evaluate(() => globalThis.whatsappFixture.external),
    [],
  );
  await quit();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify({ passed: true, cases, realAccountLinked: false }, null, 2) +
      "\n",
  );
  console.log(
    JSON.stringify({ passed: true, cases, screenshots: output }, null, 2),
  );
} catch (error) {
  if (client) await capture("failure.png").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  if (client) await quit().catch(() => client?.close().catch(() => {}));
  await rm(root, { recursive: true, force: true });
}
