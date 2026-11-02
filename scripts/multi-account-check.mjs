import { nativeHeaderChoice } from "./native-menu-fixture.mjs";
import { _electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(
  new URL("../outputs/multi-account-check", import.meta.url),
);
const root = await mkdtemp(join(tmpdir(), "tin-nhan-multi-"));
const executablePath =
  "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron";
const providers = {
  zalo: "https://chat.zalo.me/",
  messenger: "https://www.facebook.com/messages/",
  telegram: "https://web.telegram.org/k/",
};
const profile = join(root, "TinNhanDesktop");
await mkdir(profile, { recursive: true });
await writeFile(
  join(profile, "window.json"),
  JSON.stringify({
    active: "telegram",
    collapsed: false,
    bounds: { width: 1280, height: 840 },
    preferences: {
      paused: false,
      shortcut: false,
      notifications: { zalo: "ask", messenger: "mute", telegram: "allow" },
    },
  }),
);
const storageWrite = `(async()=>{localStorage.setItem('marker',MARKER);await new Promise((resolve,reject)=>{const r=indexedDB.open('multi-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('markers','readwrite');tx.objectStore('markers').put(MARKER,'value');tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>reject(tx.error);};});return true;})()`;
const storageRead = `(async()=>({local:localStorage.getItem('marker'),db:await new Promise((resolve,reject)=>{const r=indexedDB.open('multi-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('markers');const get=tx.objectStore('markers').get('value');get.onsuccess=()=>resolve(get.result??null);tx.oncomplete=()=>db.close();};})}))()`;
const seedPath = join(root, "seed.cjs");
await writeFile(
  seedPath,
  `const {app,session,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(profile)});globalThis.seedReady=app.whenReady().then(async()=>{for(const [id,url] of Object.entries(${JSON.stringify(providers)})){const ses=session.fromPartition('persist:'+id);ses.protocol.handle('https',()=>new Response('<html><body>Legacy storage fixture</body></html>',{headers:{'content-type':'text/html'}}));await ses.cookies.set({url,name:'fixture-account',value:'legacy-'+id,expirationDate:Date.now()/1000+86400});if(id==='messenger')for(const [name,value]of [['c_user','legacy-user'],['xs','legacy-session']])await ses.cookies.set({url,domain:'.facebook.com',path:'/',name,value,secure:true,httpOnly:true,expirationDate:Date.now()/1000+86400});const w=new BrowserWindow({show:false,webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false}});await w.loadURL(url);await w.webContents.executeJavaScript(${JSON.stringify(storageWrite)}.replaceAll('MARKER',JSON.stringify('legacy-'+id)));ses.flushStorageData();await ses.cookies.flushStore();}return true;});`,
);
const chrome = join(root, "Library/Application Support/Google/Chrome");
await mkdir(join(chrome, "Default"), { recursive: true });
await writeFile(
  join(chrome, "Local State"),
  JSON.stringify({
    profile: {
      info_cache: {
        Default: { name: "Fixture Chrome", user_name: "fixture@example.test" },
      },
    },
  }),
);
await writeFile(
  join(chrome, "Default", "Cookies"),
  "fixture database intercepted by test",
);
const bootstrap = join(root, "bootstrap.cjs");
await writeFile(
  bootstrap,
  `
const e=require('electron');e.app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};
globalThis.fixture={checks:{},requests:{},notifications:[],imports:0,accountMenu:null};
const originalPopup=e.Menu.prototype.popup;
e.Menu.prototype.popup=function(options){
 if(this.items.some(item=>item.id?.startsWith('account-'))){
  if(fixture.accountMenu)throw Error('Account menu opened twice');
  fixture.accountMenu={menu:this,options};return;
 }
 return originalPopup.call(this,options);
};
e.dialog.showMessageBox=async()=>({response:1});
e.Notification.isSupported=()=>true;e.Notification.prototype.show=function(){fixture.notifications.push(this);this.emit('show');};e.Notification.prototype.close=function(){this.emit('close');};
const cp=require('node:child_process'),util=require('node:util');
const fake=()=>{};fake[util.promisify.custom]=async(file,args)=>{
 if(file==='/usr/bin/security'){fixture.imports++;return {stdout:'fixture-password\\n',stderr:''};}
 if(file==='/usr/bin/sqlite3')return {stdout:JSON.stringify(args.at(-1).includes('FROM meta')?[{value:'24'}]:['c_user','xs'].map(name=>({host:'.facebook.com',name,path:'/',secure:1,httpOnly:1,expiry:(Date.now()/1000+86400+11644473600)*1000000,encrypted:'',plain:name==='c_user'?'fixture-source-user':'fixture-source-session'}))),stderr:''};
 throw Error('unexpected fixture subprocess');
};cp.execFile=fake;
const original=e.session.fromPartition.bind(e.session),seen=new Set();
e.session.fromPartition=function(partition,...args){const ses=original(partition,...args);if(!seen.has(partition)){seen.add(partition);
 const request=ses.setPermissionRequestHandler.bind(ses),check=ses.setPermissionCheckHandler.bind(ses);
 ses.setPermissionRequestHandler=handler=>{fixture.requests[partition]=handler;request(handler);};ses.setPermissionCheckHandler=handler=>{fixture.checks[partition]=handler;check(handler);};
 ses.protocol.handle('https',async request=>{
  const host=new URL(request.url).hostname;
  if(partition.startsWith('import-')){fixture.stageStarted=(fixture.stageStarted||0)+1;await new Promise(r=>setTimeout(r,400));}
  const loggedIn=host!=='www.facebook.com'||(await ses.cookies.get({name:'c_user'})).length;
  const color=partition==='persist:zalo'?'#ffffff':partition==='persist:telegram'?'#17212b':'#18191a';
  const body=loggedIn?'<h1>Chats</h1><button aria-label="New message">New message</button><input id="contact-search-input"><div class="chatlist"><a data-peer-id="1"></a></div><div role="tab">Unread<span class="badge">0</span></div><div class="z-noti-badge-container"><i class="fa-Message_28_Filled"></i><span data-count="0"></span></div><textarea id="draft"></textarea>':'<input type="password" aria-label="Fixture login">';
  return new Response('<html><body style="background:'+color+'">'+body+'</body></html>',{headers:{'content-type':'text/html'}});
 });
}return ses;};
require(${JSON.stringify(process.cwd() + "/dist/main.cjs")});
`,
);
let client, page;
async function launch(path = bootstrap) {
  client = await _electron.launch({
    executablePath,
    args: ["--use-mock-keychain", path],
  });
  page = await client.firstWindow();
  if (path === bootstrap) {
    await page.waitForFunction(() => !!window.desktop);
    await wait(
      (s) =>
        s.accounts
          .filter((a) => !a.archived && Object.hasOwn(providers, a.provider))
          .every((a) =>
            ["authenticated", "needs-login"].includes(s.statuses[a.id]),
          ),
      "accounts loaded",
    );
  }
}
const snapshot = () => page.evaluate(() => window.desktop.state());
async function wait(predicate, label = "state") {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const s = await snapshot();
    if (predicate(s)) return s;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Timeout " + label);
}
async function quit() {
  const exit = new Promise((r) => client.process().once("exit", r));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exit;
}
async function remote(id, code) {
  return client.evaluate(
    async ({ BrowserWindow, session }, { id, code }) => {
      const views = BrowserWindow.getAllWindows()[0].contentView.children;
      const partition =
        id === "zalo" || id === "messenger" || id === "telegram"
          ? "persist:" + id
          : "persist:tn-account-" + id;
      const ses = session.fromPartition(partition);
      const view = views.find((v) => v.webContents.session === ses);
      if (!view) throw Error("missing account " + id);
      return view.webContents.executeJavaScript(code);
    },
    { id, code },
  );
}
async function cookie(id, name = "fixture-account") {
  return client.evaluate(
    async ({ session }, { id, name }) => {
      const partition = ["zalo", "messenger", "telegram"].includes(id)
        ? "persist:" + id
        : "persist:tn-account-" + id;
      const c = await session.fromPartition(partition).cookies.get({ name });
      return c[0]?.value ?? null;
    },
    { id, name },
  );
}
async function viewIds() {
  return client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.map((v) => v.webContents.id)
      .sort(),
  );
}
async function assertToolbar(provider, accountId) {
  await page.waitForFunction(
    ({ provider, accountId }) =>
      document
        .querySelector("#platform-" + provider)
        ?.getAttribute("aria-selected") === "true" &&
      document.querySelector("#account-select")?.value === accountId,
    { provider, accountId },
  );
  assert.equal(
    await page.locator("#account-select").evaluate((node) => node.tagName),
    "BUTTON",
  );
  for (const id of Object.keys(providers)) {
    assert.equal(
      await page.locator("#platform-" + id).getAttribute("role"),
      "tab",
    );
    assert.equal(
      await page.locator("#platform-" + id).getAttribute("aria-selected"),
      String(id === provider),
    );
  }
  const account = (await snapshot()).accounts.find(
    (account) => account.id === accountId,
  );
  assert.equal(
    await page.locator("#account-select-label").textContent(),
    account.name,
  );
  assert.equal(
    await page.locator("#account-select").getAttribute("aria-haspopup"),
    "menu",
  );
}
async function selectAccount(accountId) {
  const before = await snapshot();
  const provider = before.accounts.find(
    (account) => account.id === before.active,
  ).provider;
  await page.locator("#account-select").click();
  const deadline = Date.now() + 10_000;
  while (!(await client.evaluate(() => !!globalThis.fixture.accountMenu))) {
    assert.ok(Date.now() < deadline, "Native account menu must open");
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  assert.deepEqual(
    await client.evaluate(() =>
      globalThis.fixture.accountMenu.menu.items
        .filter((item) => item.id?.startsWith("account-"))
        .map((item) => ({
          id: item.id,
          type: item.type,
          checked: item.checked,
        })),
    ),
    before.accounts
      .filter((account) => !account.archived && account.provider === provider)
      .map((account) => ({
        id: `account-${account.id}`,
        type: "radio",
        checked: account.id === before.active,
      })),
  );
  await client.evaluate(({ BrowserWindow }, accountId) => {
    const captured = globalThis.fixture.accountMenu;
    globalThis.fixture.accountMenu = null;
    const item = captured.menu.getMenuItemById(`account-${accountId}`);
    if (!item) throw Error(`Missing account menu item ${accountId}`);
    item.click(item, BrowserWindow.getAllWindows()[0], {});
    captured.options.callback();
  }, accountId);
  await page.waitForFunction(
    () =>
      document
        .querySelector("#account-select")
        .getAttribute("aria-expanded") === "false",
  );
}
try {
  await launch(seedPath);
  assert.equal(
    await client.evaluate(async () => await globalThis.seedReady),
    true,
  );
  await quit();
  await launch();
  assert.equal((await snapshot()).active, "telegram");
  await assertToolbar("telegram", "telegram");
  await wait(
    (s) =>
      ["zalo", "messenger", "telegram"].every(
        (id) => s.statuses[id] === "authenticated",
      ),
    "legacy authenticated",
  );
  assert.deepEqual(
    (await snapshot()).accounts
      .filter((a) => Object.hasOwn(providers, a.provider))
      .map((a) => a.id),
    ["zalo", "messenger", "telegram"],
  );
  assert.equal((await snapshot()).preferences.notifications.telegram, "allow");
  for (const id of Object.keys(providers)) {
    assert.equal(await cookie(id), "legacy-" + id);
    assert.deepEqual(await remote(id, storageRead), {
      local: "legacy-" + id,
      db: "legacy-" + id,
    });
  }
  assert.equal(
    JSON.parse(await readFile(join(profile, "window.json.pre-0.4"), "utf8"))
      .active,
    "telegram",
  );
  const added = {};
  for (const provider of Object.keys(providers)) {
    await nativeHeaderChoice(
      client,
      page,
      "header-add-account",
      "#provider-add",
    );
    await page.locator("#account-editor").waitFor({ state: "visible" });
    await page.locator("#account-provider").selectOption(provider);
    await page.locator("#account-name").fill("Công việc " + provider);
    await page.locator("#account-avatar").fill("💼");
    await page.locator("#account-editor-save").click();
    const s = await wait(
      (s) =>
        s.accounts.some((a) => a.provider === provider && a.id !== provider) &&
        s.active !== provider &&
        s.active.startsWith("acc_"),
      "new account active",
    );
    const account = s.accounts.find(
      (a) => a.provider === provider && a.id !== provider,
    );
    added[provider] = account.id;
    await assertToolbar(provider, account.id);
    await wait(
      (s) => ["authenticated", "needs-login"].includes(s.statuses[account.id]),
      "new page loaded",
    );
    assert.equal(await cookie(account.id), null);
    assert.deepEqual(await remote(account.id, storageRead), {
      local: null,
      db: null,
    });
    await remote(
      account.id,
      storageWrite.replaceAll("MARKER", JSON.stringify("new-" + provider)),
    );
    await client.evaluate(
      async ({ session }, { id, url, provider }) =>
        session.fromPartition("persist:tn-account-" + id).cookies.set({
          url,
          name: "fixture-account",
          value: "new-" + provider,
          expirationDate: Date.now() / 1000 + 86400,
        }),
      { id: account.id, url: providers[provider], provider },
    );
  }
  assert.equal((await snapshot()).accounts.length, 11);
  const before = await viewIds();
  await remote(
    "telegram",
    'document.querySelector("#draft").value="legacy draft"',
  );
  await remote(
    added.telegram,
    'document.querySelector("#draft").value="new draft"',
  );
  await remote("telegram", 'document.querySelector(".badge").textContent="2"');
  await remote(
    added.telegram,
    'document.querySelector(".badge").textContent="9"',
  );
  await wait(
    (s) =>
      s.unread.telegram.count === 2 && s.unread[added.telegram].count === 9,
    "per-account unread",
  );
  await selectAccount("telegram");
  await wait((s) => s.active === "telegram", "select legacy Telegram account");
  await assertToolbar("telegram", "telegram");
  await selectAccount(added.telegram);
  await wait(
    (s) => s.active === added.telegram,
    "select second Telegram account",
  );
  await assertToolbar("telegram", added.telegram);
  assert.equal(
    await remote("telegram", 'document.querySelector("#draft").value'),
    "legacy draft",
  );
  assert.equal(
    await remote(added.telegram, 'document.querySelector("#draft").value'),
    "new draft",
  );
  assert.deepEqual(await viewIds(), before);
  await page.evaluate(
    (id) =>
      window.desktop.editAccount(id, "<img src=x onerror=window.bad=1>", "A"),
    added.zalo,
  );
  assert.equal(await page.evaluate(() => window.bad), undefined);
  assert.equal(
    await page
      .locator(
        `#account-manager [data-account-id="${added.zalo}"] .account-identity strong`,
      )
      .textContent(),
    "<img src=x onerror=window.bad=1>",
  );
  await page.evaluate(
    (id) => window.desktop.editAccount(id, "Công việc", "💼"),
    added.zalo,
  );
  await page.evaluate((id) => window.desktop.moveAccount(id, -1), added.zalo);
  assert.deepEqual(
    (await snapshot()).accounts
      .filter((a) => a.provider === "zalo")
      .map((a) => a.id),
    [added.zalo, "zalo"],
  );
  assert.deepEqual(await viewIds(), before);
  async function destinationPair(present) {
    await client.evaluate(
      async ({ session }, { id, present }) => {
        const jar = session.fromPartition("persist:tn-account-" + id).cookies;
        for (const name of ["c_user", "xs"]) {
          if (present)
            await jar.set({
              url: "https://www.facebook.com/",
              domain: ".facebook.com",
              path: "/",
              name,
              value: "own-" + name,
              secure: true,
              httpOnly: true,
            });
          else await jar.remove("https://www.facebook.com/", name);
        }
      },
      { id: added.messenger, present },
    );
  }
  // Cookie auth can precede the initial DOM/status probe.
  await destinationPair(true);
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.importSession("Default", id),
        added.messenger,
      )
    ).status,
    "already-connected",
  );
  assert.equal(await cookie(added.messenger, "c_user"), "own-c_user");
  await destinationPair(false);
  // A new login established while the source is being staged must also survive.
  const raced = page.evaluate(
    (id) => window.desktop.importSession("Default", id),
    added.messenger,
  );
  await wait((s) => s.importing, "race import started");
  const stageDeadline = Date.now() + 10000;
  while (!(await client.evaluate(() => globalThis.fixture.stageStarted > 0))) {
    assert.ok(
      Date.now() < stageDeadline,
      "source staging must start before target changes",
    );
    await new Promise((r) => setTimeout(r, 10));
  }
  await destinationPair(true);
  assert.equal((await raced).status, "already-connected");
  assert.equal(await cookie(added.messenger, "c_user"), "own-c_user");
  assert.equal(await cookie(added.messenger, "xs"), "own-xs");
  await destinationPair(false);
  const importPromise = page.evaluate(
    (id) => window.desktop.importSession("Default", id),
    added.messenger,
  );
  await wait((s) => s.importing, "import started");
  await page.evaluate(() => window.desktop.activate("messenger"));
  assert.equal(
    (
      await page.evaluate(
        (id) => window.desktop.archiveAccount(id),
        added.messenger,
      )
    ).ok,
    false,
  );
  assert.equal((await importPromise).status, "imported");
  await wait(
    (s) =>
      s.accounts
        .filter((a) => !a.archived && Object.hasOwn(providers, a.provider))
        .every((a) => s.statuses[a.id] === "authenticated"),
    "six authenticated after import",
  );
  assert.equal(await cookie("messenger", "c_user"), "legacy-user");
  assert.equal(await cookie(added.messenger, "c_user"), "fixture-source-user");
  assert.equal(
    (
      await page.evaluate(() =>
        window.desktop.importSession("Default", "messenger"),
      )
    ).status,
    "already-connected",
  );
  await page.evaluate(() =>
    window.desktop.setNotification("telegram", "allow"),
  );
  await page.evaluate(
    (id) => window.desktop.setNotification(id, "allow"),
    added.telegram,
  );
  await remote("telegram", "window.__tinNhanNotificationClicked()");
  await wait((s) => s.active === "telegram", "first click");
  await remote(added.telegram, "window.__tinNhanNotificationClicked()");
  await wait(
    (s) => s.active === added.telegram,
    "second-account notification click",
  );
  await page.evaluate(() => window.desktop.setNotification("telegram", "mute"));
  assert.equal(await remote("telegram", "Notification.permission"), "denied");
  assert.equal(
    await remote(added.telegram, "Notification.permission"),
    "granted",
  );
  await page.evaluate(() => window.desktop.archiveAccount("zalo"));
  assert.equal(
    (await snapshot()).accounts.find((a) => a.id === "zalo").archived,
    true,
  );
  assert.equal(await cookie("zalo"), "legacy-zalo");
  await page.evaluate(() => window.desktop.restoreAccount("zalo"));
  await wait((s) => s.statuses.zalo === "authenticated", "restore");
  assert.deepEqual(await remote("zalo", storageRead), {
    local: "legacy-zalo",
    db: "legacy-zalo",
  });
  assert.equal(
    await remote("telegram", 'document.querySelector("#draft").value'),
    "legacy draft",
  );
  assert.equal(
    await remote(added.telegram, 'document.querySelector("#draft").value'),
    "new draft",
  );
  await page.evaluate((id) => window.desktop.activate(id), added.telegram);
  await page.evaluate(() => window.desktop.settings());
  await client.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1024, 720),
  );
  await mkdir(output, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(output, "settings-dark.png") });
  await page.evaluate((id) => window.desktop.activate(id), added.telegram);
  await assertToolbar("telegram", added.telegram);
  await page.screenshot({ path: join(output, "toolbar-dark.png") });
  await page.evaluate(() => window.desktop.activate("zalo"));
  await page.evaluate(() => window.desktop.settings());
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(output, "settings-light.png") });
  await page.evaluate((id) => window.desktop.activate(id), added.telegram);
  await quit();
  await launch();
  assert.equal((await snapshot()).active, added.telegram);
  await assertToolbar("telegram", added.telegram);
  await wait(
    (s) =>
      s.accounts
        .filter((a) => !a.archived && Object.hasOwn(providers, a.provider))
        .every((a) => s.statuses[a.id] === "authenticated"),
    "six authenticated after relaunch",
  );
  assert.equal((await snapshot()).accounts.length, 11);
  assert.equal((await snapshot()).preferences.notifications.telegram, "mute");
  assert.equal(
    (await snapshot()).preferences.notifications[added.telegram],
    "allow",
  );
  for (const provider of Object.keys(providers)) {
    assert.equal(await cookie(provider), "legacy-" + provider);
    assert.deepEqual(await remote(provider, storageRead), {
      local: "legacy-" + provider,
      db: "legacy-" + provider,
    });
    assert.equal(await cookie(added[provider]), "new-" + provider);
    assert.deepEqual(await remote(added[provider], storageRead), {
      local: "new-" + provider,
      db: "new-" + provider,
    });
  }
  console.log(
    "PASS migration retains legacy cookie/localStorage/IndexedDB, six isolated accounts, platform tabs/native account selection and drafts, safe labels/order/view identity, captured Messenger import, account unread/permission/click routing, reversible archive, saved identity/preferences after relaunch",
  );
} finally {
  await client?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
