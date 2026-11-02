// Native header fixture; all accounts/pages/storage are synthetic and temporary.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import executablePath from "electron";
const entry = process.env.GOM_SMOKE_APP_ASAR
  ? join(process.env.GOM_SMOKE_APP_ASAR, "dist/main.cjs")
  : fileURLToPath(new URL("../dist/main.cjs", import.meta.url));
const project = fileURLToPath(new URL("..", import.meta.url)),
  root = await mkdtemp(join(tmpdir(), "gom-header-")),
  output = join(project, "outputs/header-check"),
  bootstrap = join(root, "bootstrap.cjs");
let client, page;
const checks = [],
  errors = [];
await writeFile(
  bootstrap,
  `
const e=require('electron');e.app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};process.env.LOCALAPPDATA=${JSON.stringify(root)};
globalThis.headerFixture={sessions:new Map(),menu:null,closedMenu:null};
const handle=e.ipcMain.handle.bind(e.ipcMain);
e.ipcMain.handle=(channel,listener)=>handle(channel,async(...args)=>{
 const result=await listener(...args);
 if(channel==='desktop' && args[1]==='navigation-menu' && headerFixture.holdResponse){
   headerFixture.heldAction=result;
   return new Promise(resolve=>{headerFixture.releaseResponse=()=>{headerFixture.holdResponse=false;delete headerFixture.releaseResponse;resolve(result);};});
 }
 return result;
});
e.Menu.prototype.popup=function(options){if(headerFixture.menu)throw Error('duplicate native menu');headerFixture.menu={menu:this,options};};
e.Menu.prototype.closePopup=function(){const m=headerFixture.menu;if(m?.menu===this){headerFixture.menu=null;headerFixture.closedMenu=m;m.options.callback?.();}};
e.dialog.showMessageBox=async()=>({response:1});e.shell.openExternal=async()=>{throw Error('Unexpected external navigation');};
e.Notification.isSupported=()=>true;e.Notification.prototype.show=function(){this.emit('show')};e.Notification.prototype.close=function(){this.emit('close')};
e.safeStorage.isAsyncEncryptionAvailable=async()=>true;e.safeStorage.encryptStringAsync=async t=>Buffer.from(t);e.safeStorage.decryptStringAsync=async b=>({result:b.toString(),shouldReEncrypt:false});
const from=e.session.fromPartition.bind(e.session);e.session.fromPartition=(...args)=>{const s=from(...args);if(!headerFixture.sessions.has(s)){headerFixture.sessions.set(s,args[0]);s.protocol.handle('https',()=>new Response('<!doctype html><html><head><title>Trang kiểm thử</title><style>body{font:14px -apple-system,sans-serif;background:#f7f7f2;color:#172e2c;margin:0;display:flex;height:100vh}aside{width:230px;padding:24px;background:#fff;border-right:1px solid #d7e3dc}h2{font-size:18px}.chat{padding:22px 0;font-size:13px}main{padding:25px 34px;flex:1}textarea{display:block;margin-top:120px;width:80%;height:64px;font:inherit;padding:14px;border:1px solid #d7e3dc;border-radius:10px}.bubble{padding:15px 20px;background:#fff;border:1px solid #d7e3dc;border-radius:12px;display:inline-block;margin-top:32px}small{color:#586e67;display:block;line-height:1.7}</style></head><body><aside><h2>Tin nhắn</h2><div class="chat">Nhóm kiểm thử<small>Trang giả, không có tài khoản thật</small></div></aside><main><strong>Nhóm kiểm thử giao diện</strong><small>Chuyển tab và menu giữ nguyên các trang đang mở.</small><div class="bubble">Header gọn hơn, cuộc trò chuyện vẫn ở đây.</div><textarea id="draft" placeholder="Bản nháp kiểm thử"></textarea></main><script>window.fixtureToken=crypto.randomUUID()</script></body></html>',{headers:{'content-type':'text/html; charset=utf-8'}}));}return s;};
require(${JSON.stringify(entry)});
`,
);
const state = () => page.evaluate(() => window.desktop.state());
async function eventually(label, fn) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timed out: " + label);
}
async function run(label, fn) {
  await fn();
  checks.push(label);
  console.log("PASS " + label);
}
async function views() {
  return client.evaluate(async ({ webContents }) => {
    const result = {};
    for (const w of webContents.getAllWebContents()) {
      const partition = headerFixture.sessions.get(w.session);
      if (
        !partition ||
        w.isCrashed() ||
        !w.getURL().startsWith("https:") ||
        w.isLoadingMainFrame()
      )
        continue;
      try {
        result[partition] = {
          id: w.id,
          ...(await w.executeJavaScript(
            '({token:window.fixtureToken,draft:document.querySelector("#draft").value})',
          )),
        };
      } catch {}
    }
    return result;
  });
}
async function openMenu(selector) {
  await page.locator(selector).click();
  await eventually("native menu", () =>
    client.evaluate(() => !!headerFixture.menu),
  );
  return client.evaluate(() =>
    headerFixture.menu.menu.items.map((i) => ({
      id: i.id,
      label: i.label,
      enabled: i.enabled,
      type: i.type,
    })),
  );
}
async function selectMenu(id, dismiss = true) {
  return client.evaluate(
    (_e, { id, dismiss }) => {
      const m = headerFixture.menu;
      if (!m) throw Error("missing menu");
      const item = m.menu.getMenuItemById(id);
      if (!item || !item.enabled) throw Error("missing/disabled menu " + id);
      item.click();
      if (dismiss) {
        headerFixture.menu = null;
        headerFixture.closedMenu = m;
        m.options.callback?.();
      }
    },
    { id, dismiss },
  );
}
async function dismiss() {
  await client.evaluate(() => {
    const m = headerFixture.menu;
    headerFixture.menu = null;
    if (m) {
      headerFixture.closedMenu = m;
      m.options.callback?.();
    }
  });
}
async function action(id) {
  await openMenu("#navigation-menu");
  await selectMenu(id);
}
async function closeEditor() {
  await page.evaluate(() => {
    window.headerEditorClosed = new Promise((resolve) =>
      document
        .querySelector("#account-editor")
        .addEventListener("close", resolve, { once: true }),
    );
  });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    await window.headerEditorClosed;
    await window.desktop.state();
  });
  await page.locator("#account-editor").waitFor({ state: "hidden" });
}
async function preserve(before) {
  const after = await views();
  for (const [id, value] of Object.entries(before))
    assert.deepEqual(after[id], value, id);
}
try {
  client = await _electron.launch({ executablePath, args: [bootstrap] });
  page = await client.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.desktop);
  await eventually(
    "eight pages loaded",
    async () => Object.keys(await views()).length >= 8,
  );
  await run(
    "header keeps 52px and removes duplicate standalone actions",
    async () => {
      assert.equal(
        await page
          .locator("header")
          .evaluate((e) => e.getBoundingClientRect().height),
        52,
      );
      assert.equal(
        await page
          .locator(
            "header #theme-toggle,header #settings,header #float-chat,header #add-account-toolbar",
          )
          .count(),
        0,
      );
      assert.equal(await page.locator("header #provider-add").count(), 1);
      assert.equal(
        await page.locator("#workspace-label").innerText(),
        "Thường",
      );
      assert.equal(await page.locator(".provider-tab-close").count(), 0);
    },
  );
  let original;
  await run(
    "compact tabs retain labels for active/pinned provider and native drafts on navigation",
    async () => {
      await client.evaluate(async ({ webContents }) => {
        for (const w of webContents.getAllWebContents())
          if (
            headerFixture.sessions.has(w.session) &&
            w.getURL().startsWith("https:")
          )
            await w.executeJavaScript(
              'document.querySelector("#draft").value="KEEP_HEADER_DRAFT";true',
            );
      });
      original = await views();
      await page.locator("#platform-telegram").click();
      await eventually(
        "telegram selected",
        async () => (await state()).active === "telegram",
      );
      assert.notEqual(
        await page
          .locator("#platform-telegram .provider-tab-label")
          .evaluate((n) => getComputedStyle(n).display),
        "none",
      );
      assert.equal(
        await page
          .locator("#platform-zalo .provider-tab-label")
          .evaluate((n) => getComputedStyle(n).display),
        "none",
      );
      await page.evaluate(() => window.desktop.pinProvider("telegram"));
      await eventually("pinned selected", async () =>
        (await state()).providerTabs.pinned.includes("telegram"),
      );
      assert.notEqual(
        await page
          .locator("#platform-telegram .provider-tab-label")
          .evaluate((n) => getComputedStyle(n).display),
        "none",
      );
      await preserve(original);
    },
  );
  await run(
    "one add menu opens provider library or account editor only after dismissal",
    async () => {
      const items = await openMenu("#provider-add");
      assert.ok(items.some((i) => i.id === "header-add-provider"));
      assert.ok(items.some((i) => i.id === "header-add-account"));
      await selectMenu("header-add-account", false);
      assert.equal(
        await page.locator("#account-editor").evaluate((d) => d.open),
        false,
      );
      await dismiss();
      await page.locator("#account-editor").waitFor({ state: "visible" });
      await closeEditor();
      await openMenu("#provider-add");
      await selectMenu("header-add-provider");
      await eventually(
        "provider library",
        async () => (await state()).panel === "providers",
      );
      await page.evaluate(() => window.desktop.activate("zalo"));
      await preserve(original);
    },
  );
  await run(
    "global tools open settings/resources/backup/theme/focus without recreating pages",
    async () => {
      await action("header-settings");
      await eventually(
        "settings",
        async () => (await state()).panel === "settings",
      );
      await action("header-resources");
      await page.locator("#tab-resources").waitFor({ state: "visible" });
      await action("header-backup");
      await page.locator("#tab-backup").waitFor({ state: "visible" });
      const before = (await state()).presentation.theme;
      await action("header-theme");
      await eventually(
        "theme changed",
        async () => (await state()).presentation.theme !== before,
      );
      await action("header-focus");
      await page.locator("#focus-duration").waitFor({ state: "visible" });
      assert.equal(
        await page
          .locator("#focus-duration")
          .evaluate((e) => document.activeElement === e),
        true,
      );
      await page.locator("#focus-duration").selectOption("30");
      await page.locator("#focus-start").click();
      await eventually(
        "Focus active",
        async () => !!(await state()).preferences.focus,
      );
      assert.equal(await page.locator("#focus-open").isVisible(), true);
      await page.evaluate(() => window.desktop.activate("zalo"));
      await preserve(original);
    },
  );
  await run(
    "account menu retains peers and exposes add/floating actions",
    async () => {
      const items = await openMenu("#account-select");
      assert.ok(items.some((i) => i.id === "account-zalo"));
      assert.equal(
        items.some((i) => i.id === "account-gmail"),
        false,
      );
      assert.ok(items.some((i) => i.id === "header-account-float"));
      await selectMenu("header-account-add");
      await page.locator("#account-editor").waitFor({ state: "visible" });
      await closeEditor();
    },
  );
  await run(
    "account floating choice waits for dismissal and returns the same native draft",
    async () => {
      await page.evaluate(() => window.desktop.activate("zalo"));
      await page.locator("#settings-panel").waitFor({ state: "hidden" });
      const before = await views();
      const floatMenu = await openMenu("#account-select");
      assert.equal(
        floatMenu.find((i) => i.id === "header-account-float").enabled,
        true,
        JSON.stringify({
          panel: (await state()).panel,
          active: (await state()).active,
          pages: await client.evaluate(({ webContents }) =>
            webContents.getAllWebContents().map((w) => ({
              id: w.id,
              url: w.getURL(),
              crashed: w.isCrashed(),
            })),
          ),
        }),
      );
      await selectMenu("header-account-float", false);
      assert.equal((await state()).floating.detached, false);
      await dismiss();
      await eventually(
        "floating detached",
        async () => (await state()).floating.detached,
      );
      await preserve(before);
      await page.evaluate(() => window.desktop.activate("zalo"));
      await eventually(
        "floating returned",
        async () => !(await state()).floating.detached,
      );
      await client.evaluate(({ app, BrowserWindow }) => {
        app.focus({ steal: true });
        const main = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("index.html"),
        );
        main.show();
        main.focus();
        main.webContents.focus();
      });
      await preserve(before);
    },
  );
  await run(
    "stale native choices cannot open editor or change theme after account/epoch changes",
    async () => {
      await openMenu("#provider-add");
      await selectMenu("header-add-account", false);
      await page.evaluate(() => window.desktop.activate("telegram"));
      await dismiss();
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("#account-editor").evaluate((d) => d.open),
        false,
      );
      const before = (await state()).presentation.theme;
      await openMenu("#navigation-menu");
      await selectMenu("header-theme", false);
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      await page.waitForTimeout(100);
      assert.equal((await state()).presentation.theme, before);
    },
  );
  await run(
    "context round trips permanently revoke tools, provider and account menu choices",
    async () => {
      await page.evaluate(() => window.desktop.activate("zalo"));
      await page.locator("#settings-panel").waitFor({ state: "hidden" });
      const theme = (await state()).presentation.theme;
      await openMenu("#navigation-menu");
      await selectMenu("header-theme", false);
      await page.evaluate(async () => {
        await window.desktop.activate("telegram");
        await window.desktop.activate("zalo");
      });
      await dismiss();
      await page.waitForTimeout(100);
      assert.equal(
        (await state()).presentation.theme,
        theme,
        "account round trip invalidates the old theme choice",
      );
      await openMenu("#provider-add");
      await selectMenu("header-add-account", false);
      await page.evaluate(async () => {
        await window.desktop.settings();
        await window.desktop.activate("zalo");
      });
      await dismiss();
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("#account-editor").evaluate((d) => d.open),
        false,
        "panel round trip invalidates the old add choice",
      );
      await openMenu("#account-select");
      await selectMenu("header-account-add", false);
      await page.evaluate(async () => {
        await window.desktop.accountEditor(true);
        await window.desktop.accountEditor(false);
      });
      await dismiss();
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("#account-editor").evaluate((d) => d.open),
        false,
        "editor round trip invalidates the old account choice",
      );
    },
  );
  await run(
    "renderer rejects an already-dismissed menu response after a context round trip",
    async () => {
      const theme = (await state()).presentation.theme;
      await client.evaluate(() => {
        headerFixture.holdResponse = true;
      });
      await openMenu("#navigation-menu");
      await selectMenu("header-theme");
      await eventually("native choice held after dismissal", () =>
        client.evaluate(() => !!headerFixture.releaseResponse),
      );
      assert.equal(
        await client.evaluate(() => headerFixture.heldAction),
        "theme",
      );
      await page.evaluate(async () => {
        await window.desktop.activate("telegram");
        await window.desktop.activate("zalo");
      });
      await client.evaluate(() => headerFixture.releaseResponse());
      await page.waitForFunction(
        () =>
          document
            .querySelector("#navigation-menu")
            .getAttribute("aria-expanded") === "false",
      );
      assert.equal((await state()).presentation.theme, theme);
    },
  );
  await run(
    "empty private workspace keeps global tools and does not expose ordinary accounts",
    async () => {
      assert.equal(
        (
          await page.evaluate(() =>
            window.desktop.privateSpace("setup", {
              password: "header-fixture-password",
            }),
          )
        ).ok,
        true,
      );
      assert.equal((await state()).accounts.length, 0);
      assert.equal(await page.locator("#workspace-label").innerText(), "Kín");
      const items = await openMenu("#navigation-menu");
      assert.equal(items.find((i) => i.id === "header-float").enabled, false);
      assert.equal(items.find((i) => i.id === "header-settings").enabled, true);
      await dismiss();
      const serialized = await page.locator("header").innerText();
      assert.equal(serialized.includes("Cá nhân"), false);
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      await page.evaluate(() => window.desktop.activate("zalo"));
    },
  );
  await run(
    "crashed page disables floating while global tools still work without creating pages",
    async () => {
      await client.evaluate(({ webContents }) => {
        const page = webContents
          .getAllWebContents()
          .find((w) => w.getURL().includes("chat.zalo.me"));
        if (!page) throw Error("missing crash target");
        page.forcefullyCrashRenderer();
      });
      await eventually(
        "crash state",
        async () => (await state()).connections.zalo.reason === "crashed",
      );
      const count = () =>
        client.evaluate(
          ({ webContents }) => webContents.getAllWebContents().length,
        );
      const before = await count();
      const tools = await openMenu("#navigation-menu");
      assert.equal(tools.find((i) => i.id === "header-float").enabled, false);
      assert.equal(
        tools.some((i) => i.id === "header-page-reload"),
        false,
      );
      await dismiss();
      const accounts = await openMenu("#account-select");
      assert.equal(
        accounts.find((i) => i.id === "header-account-float").enabled,
        false,
      );
      await dismiss();
      await action("header-resources");
      await eventually(
        "global resources on crash",
        async () => (await state()).panel === "settings",
      );
      assert.equal(await count(), before);
    },
  );
  await run(
    "940/1280 light/dark fit long custom active label with Focus and badges",
    async () => {
      const custom = await page.evaluate(() =>
        window.desktop.addProvider(
          "Website công việc có tên hiển thị rất dài",
          "https://header-fixture.example/",
        ),
      );
      assert.equal(custom.ok, true, custom.message);
      await page.evaluate(
        (id) => window.desktop.activate(id),
        custom.accountId,
      );
      await eventually(
        "custom page ready",
        async () => !!(await views())["persist:tn-account-" + custom.accountId],
      );
      await mkdir(output, { recursive: true });
      for (const [width, height, theme] of [
        [940, 640, "light"],
        [1280, 800, "dark"],
      ]) {
        await client.evaluate(
          ({ BrowserWindow }, size) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes("index.html"))
              .setContentSize(...size),
          [width, height],
        );
        await page.evaluate((theme) => window.desktop.setTheme(theme), theme);
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          theme,
        );
        const problem = await page.locator("header").evaluate(
          (header, inset) => {
            const r = header.getBoundingClientRect();
            return [...header.querySelectorAll("button")]
              .filter((b) => b.getClientRects().length)
              .filter((b) => {
                const q = b.getBoundingClientRect();
                return (
                  q.right > r.right + 1 ||
                  q.left < inset - 1 ||
                  q.bottom > r.bottom + 1
                );
              })
              .map((b) => b.id);
          },
          process.platform === "darwin" ? 94 : 8,
        );
        assert.deepEqual(problem, []);
        assert.equal(
          await page.locator("#shelf-toggle > svg").isVisible(),
          true,
        );
        assert.equal(
          await page.locator("#focus-toolbar-time").isVisible(),
          true,
        );
        assert.equal(
          await page.locator("#platform-" + custom.providerId).isVisible(),
          true,
        );
        await page.locator("header").screenshot({
          path: join(output, `header-${width}-${theme}-bar.png`),
          animations: "disabled",
        });
        await page.screenshot({
          path: join(output, `header-${width}-${theme}.png`),
          animations: "disabled",
        });
      }
    },
  );
  assert.deepEqual(errors, []);
  console.log(`${checks.length} header checks passed`);
} finally {
  if (client) await client.close();
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await rm(root, { recursive: true, force: true });
}
