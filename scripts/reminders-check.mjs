// Isolated reminder regression: temporary appData/home, mock Keychain and
// synthetic provider pages. Never reads personal accounts or shows OS alerts.
import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import electronExecutable from "electron";

const project = fileURLToPath(new URL("..", import.meta.url));
const archive = process.env.GOM_SMOKE_APP_ASAR;
const entry = archive
  ? join(archive, "dist/main.cjs")
  : join(project, "dist/main.cjs");
await access(archive || entry);
const root = await mkdtemp(join(tmpdir(), "gom-reminders-"));
const bootstrap = join(root, "bootstrap.cjs");
const checks = [];
const errors = [];
const password = "fixture-reminder-password";
let client;
let page;
const fixture = `<!doctype html><html data-reminder-fixture="true"><body>
<h1>Reminder fixture — no real accounts</h1><input id="contact-search-input">
<div class="chatlist"><a data-peer-id="fixture"></a></div>
<button aria-label="New message">New message</button><textarea id="draft"></textarea>
<script>document.documentElement.dataset.documentToken=crypto.randomUUID()</script>
</body></html>`;
await writeFile(
  bootstrap,
  `
const e = require('electron');
const root = ${JSON.stringify(root)};
e.app.setPath('appData', root);
process.env.LOCALAPPDATA = root;
require('node:os').homedir = () => root;
globalThis.reminderFixture = {sessions:new Map(), notifications:[], errors:[], windowEvents:[]};
process.on('uncaughtExceptionMonitor', error => reminderFixture.errors.push(error.message));
e.app.on('browser-window-created', (_event, window) => {
  for (const name of ['hide','show','closed']) window.on(name, () => reminderFixture.windowEvents.push({name,id:window.id}));
  window.webContents.on('render-process-gone', (_event, details) => reminderFixture.windowEvents.push({name:'render-process-gone',id:window.id,details}));
});
// Intercept only Electron's OS encryption boundary, including the Electron 45
// async API. Real product serialization, queueing and disk writes stay intact.
const crypto = require('node:crypto');
const fixtureKey = crypto.createHash('sha256').update('gom-reminders-isolated-fixture').digest();
const encrypt = text => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fixtureKey, iv);
  const bytes = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
};
const decrypt = bytes => {
  const cipher = crypto.createDecipheriv('aes-256-gcm', fixtureKey, bytes.subarray(0,12));
  cipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');
};
e.safeStorage.isEncryptionAvailable = () => true;
e.safeStorage.encryptString = encrypt;
e.safeStorage.decryptString = decrypt;
e.safeStorage.isAsyncEncryptionAvailable = async () => true;
e.safeStorage.encryptStringAsync = async text => encrypt(text);
e.safeStorage.decryptStringAsync = async bytes => ({result:decrypt(bytes),shouldReEncrypt:false});
e.clipboard.read = async () => [];
e.clipboard.write = async () => { throw Error('Unexpected fixture clipboard write'); };
e.clipboard.writeText = async () => { throw Error('Unexpected fixture clipboard text write'); };
e.app.on('will-quit', () => require('node:fs').writeFileSync(require('node:path').join(root,'quit-observed.json'), JSON.stringify({clean:true})));
const fixtureFs = require('node:fs/promises');
const fixtureWriteFile = fixtureFs.writeFile.bind(fixtureFs);
fixtureFs.writeFile = async (path,...args) => {
  const pause=reminderFixture.claimPause;
  if(pause?.armed && require('node:path').basename(String(path))==='reminders.json.tmp') {
    pause.armed=false;pause.entered=true;
    await new Promise(resolve=>{pause.release=resolve;});
  }
  return fixtureWriteFile(path,...args);
};
e.shell.openExternal = async () => { throw Error('Unexpected fixture external navigation'); };
e.dialog.showMessageBox = async () => ({response:1});
e.Notification.isSupported = () => true;
e.Notification.prototype.show = function() {
  reminderFixture.notifications.push({title:this.title,body:this.body,instance:this,closed:false});
  this.emit('show');
};
e.Notification.prototype.close = function() {
  const item=reminderFixture.notifications.find(item=>item.instance===this);
  if(item) item.closed=true;
  this.emit('close');
};
const fromPartition = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = fromPartition(...args);
  if (!reminderFixture.sessions.has(ses)) {
    reminderFixture.sessions.set(ses,args[0]);
    const respond = () => new Response(${JSON.stringify(fixture)},{headers:{'content-type':'text/html; charset=utf-8'}});
    ses.protocol.handle('https',respond);ses.protocol.handle('http',respond);
  }
  return ses;
};
require(${JSON.stringify(entry)});
`,
);
const state = () => page.evaluate(() => window.desktop.state());
const reminder = async (action, data = {}) => {
  const lockVersion = (await state()).privateSpace.lockVersion;
  return page.evaluate(
    ({ action, data }) => window.desktop.reminder(action, data),
    {
      action,
      data: { lockVersion, ...data },
    },
  );
};
const shelf = async (action, data = {}) => {
  const lockVersion = (await state()).privateSpace.lockVersion;
  return page.evaluate((request) => window.desktop.shelf(request), {
    action,
    lockVersion,
    ...data,
  });
};
const privateCommand = (action, data) =>
  page.evaluate(
    ({ action, data }) => window.desktop.privateSpace(action, data),
    { action, data },
  );
async function eventually(label, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("Timed out: " + label);
}
async function launch() {
  await rm(join(root, "quit-observed.json"), { force: true });
  client = await _electron.launch({
    executablePath: electronExecutable,
    args: ["--use-mock-keychain", bootstrap],
    timeout: 20000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(() => !!window.desktop?.state);
  assert.equal(
    await page.evaluate(() => typeof window.desktop.reminder),
    "function",
  );
  await eventually(
    "reminder state ready",
    async () => !!(await state()).reminders,
  );
  assert.deepEqual(
    await client.evaluate(({ app }) => ({
      data: app.getPath("userData"),
      session: app.getPath("sessionData"),
      mock: app.commandLine.hasSwitch("use-mock-keychain"),
    })),
    {
      data: join(root, "TinNhanDesktop"),
      session: join(root, "TinNhanDesktop"),
      mock: true,
    },
  );
  assert.deepEqual((await state()).profiles, []);
  await showMain();
}
async function stop() {
  if (client) {
    assert.deepEqual(await client.evaluate(() => reminderFixture.errors), []);
    await client.close();
    client = undefined;
    assert.deepEqual(
      JSON.parse(await readFile(join(root, "quit-observed.json"), "utf8")),
      { clean: true },
    );
    const leftovers = (await readdir(join(root, "TinNhanDesktop"))).filter(
      (name) => /^reminders\.json.*\.tmp$/.test(name),
    );
    assert.deepEqual(
      leftovers,
      [],
      "clean quit leaves no unpublished reminder file",
    );
  }
}
async function run(label, work) {
  await work();
  checks.push(label);
  console.log("PASS " + label);
}
async function alerts() {
  return client.evaluate(() =>
    reminderFixture.notifications.map(({ title, body, closed }) => ({
      title,
      body,
      closed,
    })),
  );
}
async function alertCount(note) {
  return (await alerts()).filter((item) =>
    (item.title + "\n" + item.body).includes(note),
  ).length;
}
async function clickAlert(note) {
  await client.evaluate((_electron, note) => {
    const item = reminderFixture.notifications.find((item) =>
      (item.title + "\n" + item.body).includes(note),
    );
    if (!item) throw Error("Missing synthetic reminder alert");
    item.instance.emit("click");
  }, note);
}
async function activate(id) {
  await page.evaluate((id) => window.desktop.activate(id), id);
  await eventually(
    "selected account " + id,
    async () => (await state()).active === id,
  );
}
async function showMain() {
  await client.evaluate(async ({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
      /[/\\]index\.html(?:[?#]|$)/.test(w.webContents.getURL()),
    );
    const transition = (event, action) =>
      new Promise((resolve, reject) => {
        const ready = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          main.removeListener(event, ready);
          reject(Error("Missing native " + event));
        }, 5000);
        main.once(event, ready);
        action();
      });
    if (main.isMinimized()) await transition("restore", () => main.restore());
    if (!main.isVisible()) await transition("show", () => main.show());
  });
  await eventually("visible main renderer", () =>
    page.evaluate(() => document.visibilityState === "visible"),
  );
}
async function hideMain() {
  const waiting = await client.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((window) =>
      /[/\\]index\.html(?:[?#]|$)/.test(window.webContents.getURL()),
    );
    if (!main.isVisible()) return null;
    // The bootstrap observer lives for the whole main-process lifetime. Read
    // its event counter in a later evaluation, after all product hide listeners
    // have returned, before another request captures its workspace epoch.
    const previous = reminderFixture.windowEvents.filter(
      (event) => event.name === "hide" && event.id === main.id,
    ).length;
    main.hide();
    return { id: main.id, previous };
  });
  if (waiting)
    await eventually(
      "native hide privacy barrier",
      () =>
        client.evaluate(
          (_electron, { id, previous }) =>
            reminderFixture.windowEvents.filter(
              (event) => event.name === "hide" && event.id === id,
            ).length > previous,
          waiting,
        ),
      5000,
    );
}
async function unlock() {
  await showMain();
  const result = await privateCommand("unlock", { password });
  assert.equal(result.ok, true, result.message);
}
async function add(accountId, note, dueAt = Date.now() + 3600000) {
  const result = await reminder("add", { accountId, note, dueAt });
  assert.equal(result.ok, true, result.message);
  const item = (await state()).reminders.items.find(
    (item) => item.note === note,
  );
  assert.ok(item, "created reminder visible in its workspace");
  return item;
}
async function addAccount(provider, name) {
  const result = await page.evaluate(
    ({ provider, name }) => window.desktop.addAccount(provider, name, "RF"),
    { provider, name },
  );
  assert.equal(result.ok, true, result.message);
  assert.ok(result.accountId);
  await activate(result.accountId);
  return result.accountId;
}
async function dueHasPassed(id) {
  await eventually("reminder deadline passed", async () => {
    const item = (await state()).reminders.items.find((item) => item.id === id);
    return item && item.dueAt <= Date.now();
  });
}
async function onePollWithoutNewAlert(note) {
  const before = await alertCount(note);
  await new Promise((resolve) => setTimeout(resolve, 4500));
  assert.equal(
    await alertCount(note),
    before,
    note + " must not generate another OS alert",
  );
}
async function closeReminderDialog() {
  if (await page.locator("#reminders-dialog").evaluate((node) => node.open)) {
    await page.locator("#reminders-close").click();
    await page.locator("#reminders-dialog").waitFor({ state: "hidden" });
  }
}
async function localDateAfter(minutes) {
  return page.evaluate((minutes) => {
    const date = new Date(Date.now() + minutes * 60000);
    const part = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
  }, minutes);
}
async function nativeViews() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const results = [];
    for (const window of BrowserWindow.getAllWindows()) {
      for (const view of window.contentView.children) {
        const wc = view.webContents;
        if (!wc || wc.isDestroyed()) continue;
        const partition = reminderFixture.sessions.get(wc.session);
        if (!partition) continue;
        results.push({
          id: wc.id,
          partition,
          visible: view.getVisible(),
          owner: window.webContents.getURL(),
          token: await wc
            .executeJavaScript("document.documentElement.dataset.documentToken")
            .catch(() => null),
        });
      }
    }
    return results;
  });
}

try {
  await launch();
  await run("reminder bridge and scoped snapshot are available", async () => {
    assert.deepEqual((await state()).reminders.items, []);
    assert.equal((await state()).reminders.unavailable, false);
  });
  let uiItem;
  await run(
    "manual reminder UI saves an account-bound note and future time",
    async () => {
      await activate("zalo");
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      await page.locator("#reminder-account").selectOption("zalo");
      await page.locator("#reminder-note").fill("UI_REMINDER_FIXTURE_QUOTE");
      const local = await page.evaluate(() => {
        const date = new Date(Date.now() + 3600000);
        const part = (value) => String(value).padStart(2, "0");
        return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
      });
      await page.locator("#reminder-due").fill(local);
      await page.locator("#reminder-save").click();
      await eventually("UI reminder saved", async () =>
        (await state()).reminders.items.some(
          (item) => item.note === "UI_REMINDER_FIXTURE_QUOTE",
        ),
      );
      uiItem = (await state()).reminders.items.find(
        (item) => item.note === "UI_REMINDER_FIXTURE_QUOTE",
      );
      assert.equal(uiItem.accountId, "zalo");
      assert.ok(uiItem.dueAt > Date.now());
      assert.equal(uiItem.completedAt, null);
      await page.locator(`[data-reminder-id="${uiItem.id}"]`).waitFor();
      await closeReminderDialog();
    },
  );
  await run(
    "reminder modal closes shelf, returns floating chat once, and masks native pages",
    async () => {
      await activate("zalo");
      await eventually(
        "synthetic native page",
        async () =>
          !!(await nativeViews()).find(
            (view) => view.partition === "persist:zalo",
          )?.token,
      );
      const original = (await nativeViews()).find(
        (view) => view.partition === "persist:zalo",
      );
      assert.equal((await shelf("surface", { open: true })).ok, true);
      assert.equal((await state()).shelf.open, true);
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      assert.equal((await state()).shelf.open, false);
      assert.ok(
        (await nativeViews()).every((view) => !view.visible),
        "modal masks every native service page",
      );
      await closeReminderDialog();
      await eventually(
        "native source restored",
        async () =>
          (await nativeViews()).find((view) => view.id === original.id)
            ?.visible,
      );
      assert.equal((await state()).active, "zalo");
      const detached = await page.evaluate(() => window.desktop.floatChat());
      assert.equal(detached.ok, true, detached.message);
      await eventually("floating native page", async () =>
        (await nativeViews())
          .find((view) => view.id === original.id)
          ?.owner.includes("floating.html"),
      );
      const floated = (await nativeViews()).find(
        (view) => view.id === original.id,
      );
      await showMain();
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      assert.equal((await state()).floating.detached, false);
      assert.ok((await nativeViews()).every((view) => !view.visible));
      const returned = (await nativeViews()).find(
        (view) => view.id === original.id,
      );
      assert.ok(returned.owner.includes("index.html"));
      assert.equal(
        returned.token,
        floated.token,
        "returning from floating does not reload its document",
      );
      await closeReminderDialog();
      await eventually(
        "returned native page visible",
        async () =>
          (await nativeViews()).find((view) => view.id === original.id)
            ?.visible,
      );
      assert.equal(
        (await nativeViews()).find((view) => view.id === original.id).token,
        floated.token,
      );
      assert.equal((await state()).active, "zalo");
    },
  );
  let customPersisted;
  await run(
    "multiline notes survive a chosen-date reschedule without losing account binding",
    async () => {
      const note = "MULTILINE_UI_FIXTURE\nDòng hai\t😀";
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      await page.locator("#reminder-account").selectOption("zalo");
      await page.locator("#reminder-note").fill(note);
      await page.locator("#reminder-due").fill(await localDateAfter(60));
      await page.locator("#reminder-save").click();
      await eventually("multiline reminder saved", async () =>
        (await state()).reminders.items.some((item) => item.note === note),
      );
      const created = (await state()).reminders.items.find(
        (item) => item.note === note,
      );
      const row = page.locator(`[data-reminder-id="${created.id}"]`);
      assert.equal(
        await row.locator(".reminder-item-note").textContent(),
        note,
      );
      await row.locator('[data-reminder-action="reschedule"]').click();
      const chosen = await localDateAfter(125);
      const expected = await page.evaluate(
        (value) => new Date(value).getTime(),
        chosen,
      );
      await page.locator("#reminder-reschedule-due").fill(chosen);
      await row.locator('[data-reminder-action="reschedule-save"]').click();
      await eventually(
        "chosen date saved",
        async () =>
          (await state()).reminders.items.find((item) => item.id === created.id)
            ?.dueAt === expected,
      );
      customPersisted = (await state()).reminders.items.find(
        (item) => item.id === created.id,
      );
      assert.equal(customPersisted.note, note);
      assert.equal(customPersisted.accountId, created.accountId);
      assert.equal(customPersisted.notifiedAt, null);
      assert.equal(customPersisted.completedAt, null);
      await closeReminderDialog();
      const lineEndingResult = await reminder("add", {
        accountId: "zalo",
        note: "LINE_ENDING_FIXTURE\r\nDòng hai\rDòng ba\tcuối",
        dueAt: Date.now() + 3600000,
      });
      assert.equal(lineEndingResult.ok, true, lineEndingResult.message);
      const normalized = (await state()).reminders.items.find((item) =>
        item.note.startsWith("LINE_ENDING_FIXTURE"),
      );
      assert.equal(
        normalized.note,
        "LINE_ENDING_FIXTURE\nDòng hai\nDòng ba\tcuối",
      );
    },
  );
  let once;
  await run(
    "a due normal reminder is claimed durably and notifies only once",
    async () => {
      once = await add("zalo", "NORMAL_DUE_ONCE_FIXTURE", Date.now() + 250);
      await eventually(
        "normal reminder notification",
        async () => (await alertCount(once.note)) === 1,
      );
      const claimed = (await state()).reminders.items.find(
        (item) => item.id === once.id,
      );
      assert.ok(Number.isFinite(claimed.notifiedAt));
      await onePollWithoutNewAlert(once.note);
      await activate("telegram");
      await hideMain();
      assert.equal(
        (await alerts()).find((item) => item.body.includes(once.note))?.closed,
        false,
        "ordinary hide keeps an owned normal alert active",
      );
      await clickAlert(once.note);
      await eventually(
        "notification opens exact source account",
        async () => (await state()).active === "zalo",
      );
      assert.equal((await state()).panel, "service");
      await eventually("normal alert click shows main", () =>
        page.evaluate(() => document.visibilityState === "visible"),
      );
    },
  );
  await run(
    "snoozing schedules one new delivery and preserves the note",
    async () => {
      assert.equal(
        (await reminder("snooze", { id: once.id, dueAt: Date.now() + 250 })).ok,
        true,
      );
      const snoozed = (await state()).reminders.items.find(
        (item) => item.id === once.id,
      );
      assert.equal(snoozed.note, once.note);
      assert.equal(snoozed.notifiedAt, null);
      assert.equal(snoozed.completedAt, null);
      await eventually(
        "snoozed reminder notification",
        async () => (await alertCount(once.note)) === 2,
      );
      await onePollWithoutNewAlert(once.note);
    },
  );
  await run(
    "normal reminders notify while the main window remains hidden",
    async () => {
      await hideMain();
      const hidden = await add(
        "gmail",
        "NORMAL_HIDDEN_FIXTURE",
        Date.now() + 250,
      );
      await eventually(
        "hidden reminder notification",
        async () => (await alertCount(hidden.note)) === 1,
      );
      assert.equal(
        await client.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) =>
              /[/\\]index\.html(?:[?#]|$)/.test(w.webContents.getURL()),
            )
            .isVisible(),
        ),
        false,
      );
      await clickAlert(hidden.note);
      await eventually(
        "hidden reminder click opens source",
        async () => (await state()).active === "gmail",
      );
      await showMain();
      assert.equal((await reminder("complete", { id: hidden.id })).ok, true);
      assert.equal((await reminder("remove", { id: hidden.id })).ok, true);
    },
  );
  await run(
    "global notification pause defers delivery without losing the overdue item",
    async () => {
      await page.evaluate(() => window.desktop.setPreference("paused", true));
      const paused = await add(
        "telegram",
        "NORMAL_PAUSED_FIXTURE",
        Date.now() + 250,
      );
      await dueHasPassed(paused.id);
      await onePollWithoutNewAlert(paused.note);
      assert.equal(await alertCount(paused.note), 0);
      assert.equal(
        (await state()).reminders.items.find((item) => item.id === paused.id)
          .notifiedAt,
        null,
      );
      await page.evaluate(() => window.desktop.setPreference("paused", false));
      await eventually(
        "unpaused overdue reminder notification",
        async () => (await alertCount(paused.note)) === 1,
      );
      assert.equal((await reminder("complete", { id: paused.id })).ok, true);
      assert.equal((await reminder("remove", { id: paused.id })).ok, true);
    },
  );
  let privateAccount;
  let privateItem;
  let normalPersisted;
  let deferredNormal;
  let normalEpochBeforePrivate;
  await run(
    "private reminder notes and native notifications stay confined to private space",
    async () => {
      normalPersisted = await add("zalo", "PERSISTED_NORMAL_REMINDER_FIXTURE");
      normalEpochBeforePrivate = (await state()).privateSpace.lockVersion;
      deferredNormal = await add(
        "telegram",
        "NORMAL_DEFERRED_WHILE_PRIVATE_FIXTURE",
        Date.now() + 3000,
      );
      await showMain();
      assert.equal((await privateCommand("setup", { password })).ok, true);
      assert.deepEqual((await state()).reminders.items, []);
      privateAccount = await addAccount(
        "zalo",
        "PRIVATE_REMINDER_ACCOUNT_FIXTURE",
      );
      privateItem = await add(
        privateAccount,
        "PRIVATE_NOTE_REMINDER_FIXTURE",
        Date.now() + 250,
      );
      assert.ok(
        (await state()).reminders.items.every(
          (item) => item.accountId === privateAccount,
        ),
      );
      await dueHasPassed(privateItem.id);
      await onePollWithoutNewAlert(privateItem.note);
      assert.equal(await alertCount(privateItem.note), 0);
      assert.ok(deferredNormal.dueAt <= Date.now());
      assert.equal(await alertCount(deferredNormal.note), 0);
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      await page.locator(`[data-reminder-id="${privateItem.id}"]`).waitFor();
      assert.match(
        await page.locator("#reminder-list").innerText(),
        /PRIVATE_NOTE_REMINDER_FIXTURE/,
      );
      assert.ok(
        (await nativeViews()).every((view) => !view.visible),
        "private reminder modal masks native pages",
      );
      await page
        .locator("#reminder-note")
        .fill("PRIVATE_UNSAVED_REMINDER_FIXTURE");
      const forbidden = await reminder("complete", { id: normalPersisted.id });
      assert.equal(forbidden.ok, false);
      await clickAlert(once.note);
      assert.equal((await state()).privateSpace.unlocked, true);
      assert.equal((await state()).active, privateAccount);
      await privateCommand("lock");
      await page.locator("#reminders-dialog").waitFor({ state: "hidden" });
      const locked = JSON.stringify(await state());
      assert.equal(locked.includes(privateItem.id), false);
      assert.equal(locked.includes(privateItem.note), false);
      assert.equal(locked.includes("PRIVATE_REMINDER_ACCOUNT_FIXTURE"), false);
      assert.equal(
        (await page.locator("body").textContent()).includes(privateItem.note),
        false,
      );
      assert.equal(await page.locator("#reminder-note").inputValue(), "");
      assert.equal(
        await page.locator(`[data-reminder-id="${privateItem.id}"]`).count(),
        0,
      );
      for (const action of ["open", "complete", "snooze", "remove"])
        assert.equal(
          (
            await reminder(action, {
              id: privateItem.id,
              dueAt: Date.now() + 3600000,
            })
          ).ok,
          false,
          action + " must reject a private reminder in normal space",
        );
      assert.equal(
        (
          await reminder("add", {
            accountId: privateAccount,
            note: "STALE_PRIVATE_NOTE",
            dueAt: Date.now() + 3600000,
          })
        ).ok,
        false,
      );
      await eventually(
        "deferred normal reminder after returning from private space",
        async () => (await alertCount(deferredNormal.note)) === 1,
      );
      assert.equal(
        (await reminder("complete", { id: deferredNormal.id })).ok,
        true,
      );
      assert.equal(
        (await reminder("remove", { id: deferredNormal.id })).ok,
        true,
      );
    },
  );
  await run(
    "old actions remain revoked after switching away from and back to normal space",
    async () => {
      assert.ok(
        (await state()).privateSpace.lockVersion > normalEpochBeforePrivate,
      );
      for (const action of [
        "add",
        "open",
        "snooze",
        "complete",
        "remove",
        "surface",
      ]) {
        const result = await reminder(action, {
          id: normalPersisted.id,
          accountId: "zalo",
          note: "STALE_NORMAL_AFTER_SWITCH_BACK_FIXTURE",
          dueAt: Date.now() + 3600000,
          open: true,
          lockVersion: normalEpochBeforePrivate,
        });
        assert.equal(
          result.ok,
          false,
          action + " rejects the old normal-space capability",
        );
      }
      const retained = (await state()).reminders.items.find(
        (item) => item.id === normalPersisted.id,
      );
      assert.deepEqual(retained, normalPersisted);
      assert.equal(
        (await state()).reminders.items.some(
          (item) => item.note === "STALE_NORMAL_AFTER_SWITCH_BACK_FIXTURE",
        ),
        false,
      );
      assert.equal((await state()).reminders.unavailable, false);
    },
  );
  await run(
    "encrypted reminders survive restart and already-claimed reminders do not repeat",
    async () => {
      const path = join(root, "TinNhanDesktop", "reminders.json");
      const data = await readFile(path, "utf8");
      for (const secret of [
        normalPersisted.note,
        privateItem.note,
        once.note,
        privateAccount,
      ])
        assert.equal(
          data.includes(secret),
          false,
          secret + " must not be plaintext on disk",
        );
      const envelope = JSON.parse(data);
      assert.equal(envelope.version, 1);
      assert.equal(typeof envelope.data, "string");
      await stop();
      await launch();
      assert.equal((await state()).privateSpace.unlocked, false);
      assert.equal(
        (await state()).reminders.items.find(
          (item) => item.id === normalPersisted.id,
        )?.note,
        normalPersisted.note,
      );
      assert.deepEqual(
        (await state()).reminders.items.find(
          (item) => item.id === customPersisted.id,
        ),
        customPersisted,
        "chosen date, multiline note and account survive restart",
      );
      assert.ok(
        (await state()).reminders.items.find((item) => item.id === once.id)
          ?.notifiedAt,
      );
      assert.equal(
        (await state()).reminders.items.some(
          (item) => item.id === privateItem.id,
        ),
        false,
      );
      await onePollWithoutNewAlert(once.note);
      assert.equal(await alertCount(once.note), 0);
      await unlock();
      assert.equal(
        (await state()).reminders.items.find(
          (item) => item.id === privateItem.id,
        )?.note,
        privateItem.note,
      );
      assert.equal(
        (await state()).reminders.items.some(
          (item) => item.id === normalPersisted.id,
        ),
        false,
      );
      await onePollWithoutNewAlert(privateItem.note);
      assert.equal(await alertCount(privateItem.note), 0);
      await privateCommand("lock");
    },
  );
  await run(
    "completed and deleted reminders remain changed after restart",
    async () => {
      assert.equal((await reminder("complete", { id: once.id })).ok, true);
      assert.ok(
        (await state()).reminders.items.find((item) => item.id === once.id)
          .completedAt,
      );
      assert.equal((await reminder("remove", { id: uiItem.id })).ok, true);
      assert.equal(
        (await state()).reminders.items.some((item) => item.id === uiItem.id),
        false,
      );
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      await page.locator("#reminder-done").click();
      await page.locator(`[data-reminder-id="${once.id}"]`).waitFor();
      await closeReminderDialog();
      await stop();
      await launch();
      assert.ok(
        (await state()).reminders.items.find((item) => item.id === once.id)
          ?.completedAt,
      );
      assert.equal(
        (await state()).reminders.items.some((item) => item.id === uiItem.id),
        false,
      );
      assert.equal(await alertCount(once.note), 0);
    },
  );
  await run(
    "a private-space switch revokes a normal notification claim in flight",
    async () => {
      const item = await add(
        "zalo",
        "PRIVATE_SWITCH_CLAIM_RACE_FIXTURE",
        Date.now() + 750,
      );
      await client.evaluate(() => {
        reminderFixture.claimPause = { armed: true, entered: false };
      });
      try {
        await eventually("normal notification claim write paused", () =>
          client.evaluate(() => reminderFixture.claimPause?.entered === true),
        );
        await unlock();
        assert.equal((await state()).privateSpace.unlocked, true);
        assert.equal(JSON.stringify(await state()).includes(item.note), false);
      } finally {
        await client.evaluate(() => reminderFixture.claimPause?.release?.());
      }
      await onePollWithoutNewAlert(item.note);
      assert.equal(await alertCount(item.note), 0);
      assert.equal(
        (await state()).reminders.unavailable,
        false,
        "revoked publication keeps healthy storage available",
      );
      await privateCommand("lock");
      await eventually(
        "revoked reminder can notify after returning to normal",
        async () => (await alertCount(item.note)) === 1,
      );
      assert.equal((await reminder("complete", { id: item.id })).ok, true);
      assert.equal((await reminder("remove", { id: item.id })).ok, true);
    },
  );
  await run(
    "archived account reminders cannot open or emit native alerts but can be completed",
    async () => {
      const accountId = await addAccount(
        "telegram",
        "ARCHIVED_REMINDER_ACCOUNT_FIXTURE",
      );
      const item = await add(
        accountId,
        "ARCHIVED_REMINDER_NOTE_FIXTURE",
        Date.now() + 1500,
      );
      const archived = await page.evaluate(
        (id) => window.desktop.archiveAccount(id),
        accountId,
      );
      assert.equal(archived.ok, true, archived.message);
      const retained = (await state()).reminders.items.find(
        (row) => row.id === item.id,
      );
      assert.ok(retained);
      assert.equal((await reminder("open", { id: item.id })).ok, false);
      await dueHasPassed(item.id);
      await onePollWithoutNewAlert(item.note);
      assert.equal(await alertCount(item.note), 0);
      assert.equal((await reminder("complete", { id: item.id })).ok, true);
      assert.equal((await reminder("remove", { id: item.id })).ok, true);
    },
  );
  await run(
    "malformed reminder data fails closed without overwriting the original file",
    async () => {
      await stop();
      const path = join(root, "TinNhanDesktop", "reminders.json");
      const corrupted = '{"fixture-corrupt-reminders":';
      await writeFile(path, corrupted);
      await launch();
      assert.equal((await state()).reminders.unavailable, true);
      assert.deepEqual((await state()).reminders.items, []);
      await page.locator("#reminders-open").click();
      await page.locator("#reminders-dialog").waitFor({ state: "visible" });
      assert.equal(await page.locator("#reminder-save").isDisabled(), true);
      await closeReminderDialog();
      assert.equal(
        (
          await reminder("add", {
            accountId: "zalo",
            note: "MUST_NOT_REPLACE_CORRUPT_DATA",
            dueAt: Date.now() + 3600000,
          })
        ).ok,
        false,
      );
      assert.equal(await readFile(path, "utf8"), corrupted);
    },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(await client.evaluate(() => reminderFixture.errors), []);
  await stop();
  console.log(`PASS ${checks.length} reminder groups, synthetic sessions only`);
} catch (error) {
  console.error(
    "Renderer fixture diagnostics",
    JSON.stringify(
      await page
        ?.evaluate(() => ({
          dialogs: [...document.querySelectorAll("dialog")].map((node) => ({
            id: node.id,
            open: node.open,
          })),
          feedback: document.getElementById("account-feedback")?.textContent,
          visibility: document.visibilityState,
        }))
        .catch(() => null),
    ),
    "errors",
    JSON.stringify(errors),
  );
  console.error(
    "Reminder fixture failure",
    JSON.stringify(await state().catch(() => null)),
  );
  console.error(
    "Synthetic reminder alerts",
    JSON.stringify(await alerts().catch(() => [])),
  );
  console.error(
    "Native fixture diagnostics",
    JSON.stringify(
      await client
        ?.evaluate(({ BrowserWindow }) => ({
          events: reminderFixture.windowEvents,
          windows: BrowserWindow.getAllWindows().map((window) => ({
            id: window.id,
            url: window.webContents.getURL(),
            visible: window.isVisible(),
          })),
          errors: reminderFixture.errors,
        }))
        .catch(() => null),
    ),
  );
  throw error;
} finally {
  await stop().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
