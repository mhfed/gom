// Isolated real Electron, synthetic sites and temporary data only.
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import executablePath from "electron";
const project = fileURLToPath(new URL("..", import.meta.url)),
  root = await mkdtemp(join(tmpdir(), "gom-backup-")),
  output = join(project, "outputs/backup-check");
const bootstrap = join(root, "bootstrap.cjs"),
  exported = join(root, "export.gom-config.json"),
  imported = join(root, "import.gom-config.json");
let client, page;
const checks = [],
  errors = [];
await writeFile(
  bootstrap,
  `
const e=require('electron');e.app.setPath('appData',${JSON.stringify(root)});require('node:os').homedir=()=>${JSON.stringify(root)};process.env.LOCALAPPDATA=${JSON.stringify(root)};
globalThis.backupFixture={sessions:new Map(),exportPath:${JSON.stringify(exported)},importPath:${JSON.stringify(imported)},confirm:true,failProtection:false};
e.app.relaunch=()=>require('node:fs').writeFileSync(${JSON.stringify(join(root, "relaunch"))},'yes');
e.dialog.showSaveDialog=async()=>({canceled:!backupFixture.exportPath,filePath:backupFixture.exportPath});
e.dialog.showOpenDialog=async()=>({canceled:!backupFixture.importPath,filePaths:backupFixture.importPath?[backupFixture.importPath]:[]});
e.dialog.showMessageBox=async()=>({response:backupFixture.confirm?1:0});
e.Notification.isSupported=()=>true;e.Notification.prototype.show=function(){this.emit('show')};e.Notification.prototype.close=function(){this.emit('close')};
e.safeStorage.isAsyncEncryptionAvailable=async()=>true;e.safeStorage.encryptStringAsync=async text=>Buffer.from(text);e.safeStorage.decryptStringAsync=async bytes=>({result:bytes.toString(),shouldReEncrypt:false});
e.shell.openExternal=async()=>{throw Error('Unexpected external navigation')};e.shell.openPath=async()=>'';
const fs=require('node:fs/promises'),write=fs.writeFile.bind(fs);fs.writeFile=async(path,...args)=>{if(backupFixture.failProtection&&String(path).includes('configuration-backups/'))throw Error('fixture protection write failure');return write(path,...args);};
const from=e.session.fromPartition.bind(e.session);e.session.fromPartition=(...args)=>{const s=from(...args);if(!backupFixture.sessions.has(s)){backupFixture.sessions.set(s,args[0]);s.protocol.handle('https',()=>new Response('<!doctype html><html><body><h1>Backup fixture</h1><textarea id="draft"></textarea><script>window.fixtureToken=crypto.randomUUID()</script></body></html>',{headers:{'content-type':'text/html; charset=utf-8'}}));}return s;};
require(${JSON.stringify(join(project, "dist/main.cjs"))});
`,
);
const state = () => page.evaluate(() => window.desktop.state());
async function eventually(label, predicate) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timed out: " + label);
}
async function run(label, work) {
  await work();
  checks.push(label);
  console.log("PASS " + label);
}
async function launch() {
  client = await _electron.launch({ executablePath, args: [bootstrap] });
  page = await client.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.desktop);
  await eventually("loaded ordinary page", async () => !!(await view("zalo")));
}
async function command(action, data = {}) {
  const s = await state();
  return page.evaluate(
    ({ action, data }) => window.desktop.backup(action, data),
    { action, data: { lockVersion: s.privateSpace.lockVersion, ...data } },
  );
}
async function view(id) {
  return client.evaluate(async ({ webContents }, id) => {
    const w = webContents
      .getAllWebContents()
      .find(
        (w) =>
          backupFixture.sessions.get(w.session) ===
            (id.startsWith("acc_") ? "persist:tn-account-" : "persist:") + id &&
          w.getURL().startsWith("https:"),
      );
    if (!w || w.isLoadingMainFrame()) return null;
    return {
      id: w.id,
      ...(await w.executeJavaScript(
        '({token:window.fixtureToken,draft:document.querySelector("#draft").value,stored:localStorage.getItem("backup-marker")})',
      )),
    };
  }, id);
}
async function quit() {
  const exited = new Promise((r) => client.process().once("exit", r));
  await client.evaluate(({ app }) => app.quit()).catch(() => {});
  await exited;
  client = undefined;
}
try {
  await launch();
  await run("backup bridge exists", async () =>
    assert.equal(
      await page.evaluate(() => typeof window.desktop.backup),
      "function",
    ),
  );
  let privateId;
  await run(
    "export excludes private identity and sessions and cancel preserves native draft",
    async () => {
      assert.equal(
        (
          await page.evaluate(() =>
            window.desktop.privateSpace("setup", {
              password: "fixture-password",
            }),
          )
        ).ok,
        true,
      );
      const added = await page.evaluate(() =>
        window.desktop.addAccount("telegram", "PRIVATE_BACKUP_SECRET", "PS"),
      );
      assert.equal(added.ok, true);
      privateId = added.accountId;
      assert.equal((await command("export")).ok, false);
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      await client.evaluate(async ({ webContents }) => {
        const w = webContents
          .getAllWebContents()
          .find(
            (w) => backupFixture.sessions.get(w.session) === "persist:zalo",
          );
        await w.executeJavaScript(
          'document.querySelector("#draft").value="KEEP_DRAFT";localStorage.setItem("backup-marker","KEEP_SESSION");true',
        );
      });
      const before = await view("zalo");
      assert.equal((await command("export")).ok, true);
      const text = await readFile(exported, "utf8");
      for (const secret of [
        "PRIVATE_BACKUP_SECRET",
        privateId,
        "KEEP_DRAFT",
        "KEEP_SESSION",
        "partition",
        "cookie",
        "endsAt",
      ])
        assert.equal(text.includes(secret), false, secret);
      const doc = JSON.parse(text);
      doc.accounts[0].name = "RESTORED_NAME";
      doc.navigation.presentation.theme = "dark";
      doc.preferences.updateChecks = false;
      await writeFile(imported, JSON.stringify(doc));
      const preview = await command("preview");
      assert.equal(preview.ok, true, preview.message);
      assert.equal(preview.preview.updated, 8);
      await command("cancel", { token: preview.preview.token });
      assert.deepEqual(await view("zalo"), before);
      await assert.rejects(
        readFile(
          join(root, "TinNhanDesktop", "configuration-restore.pending.json"),
        ),
      );
    },
  );
  await run(
    "malformed input and private ID collision leave current configuration untouched",
    async () => {
      const good = await readFile(imported, "utf8");
      await writeFile(imported, "no json");
      assert.equal((await command("preview")).ok, false);
      const doc = JSON.parse(good);
      doc.accounts.push({
        id: privateId,
        provider: "telegram",
        name: "ATTEMPT",
        avatar: "A",
        archived: false,
      });
      await writeFile(imported, JSON.stringify(doc));
      const result = await command("preview");
      assert.equal(result.ok, false);
      assert.equal(
        JSON.stringify(result).includes("PRIVATE_BACKUP_SECRET"),
        false,
      );
      await writeFile(imported, good);
      assert.equal((await state()).accounts[0].name, "Cá nhân");
    },
  );
  await run(
    "workspace epoch and changed configuration revoke old previews",
    async () => {
      let preview = await command("preview");
      assert.equal(preview.ok, true);
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      assert.equal(
        (await command("restore", { token: preview.preview.token })).ok,
        false,
      );
      preview = await command("preview");
      await page.evaluate(() => window.desktop.setTheme("dark"));
      assert.equal(
        (await command("restore", { token: preview.preview.token })).ok,
        false,
      );
    },
  );
  await run(
    "failed protection backup never queues restore or closes current pages",
    async () => {
      const before = await view("zalo"),
        preview = await command("preview");
      assert.equal(preview.ok, true);
      await client.evaluate(() => (backupFixture.confirm = false));
      assert.equal(
        (await command("restore", { token: preview.preview.token })).ok,
        true,
      );
      await client.evaluate(() => (backupFixture.confirm = true));
      await client.evaluate(() => (backupFixture.failProtection = true));
      assert.equal(
        (await command("restore", { token: preview.preview.token })).ok,
        false,
      );
      await client.evaluate(() => (backupFixture.failProtection = false));
      assert.deepEqual(await view("zalo"), before);
      await assert.rejects(
        readFile(
          join(root, "TinNhanDesktop", "configuration-restore.pending.json"),
        ),
      );
    },
  );
  await run(
    "preview shows imported names as text and clears them when workspace epoch changes",
    async () => {
      const original = await readFile(imported, "utf8"),
        doc = JSON.parse(original);
      doc.accounts[0].name = "<img src=x onerror=alert(1)>";
      await writeFile(imported, JSON.stringify(doc));
      await page.evaluate(() => window.desktop.settings());
      await page.locator('[data-tab="backup"]').click();
      await page.locator("#backup-import").click();
      await page.locator("#backup-preview").waitFor({ state: "visible" });
      await page.locator("#backup-preview summary").click();
      assert.equal(await page.locator("#backup-accounts img").count(), 0);
      assert.equal(
        (await page.locator("#backup-accounts").innerText()).includes(
          "<img src=x onerror=alert(1)>",
        ),
        true,
      );
      await page.evaluate(() => window.desktop.privateSpace("lock"));
      await page.locator("#backup-preview").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#backup-accounts").textContent(), "");
      assert.equal(await page.locator("#backup-file").textContent(), "");
      await writeFile(imported, original);
    },
  );
  await run(
    "settings preview renders safely and fits light/dark at 940 and 1280",
    async () => {
      await page.evaluate(() => window.desktop.settings());
      await page.locator('[data-tab="backup"]').click();
      await page.locator("#backup-import").click();
      await page.locator("#backup-preview").waitFor({ state: "visible" });
      await page.locator("#backup-preview summary").click();
      assert.equal(
        (await page.locator("#backup-preview").innerText()).includes(
          "RESTORED_NAME",
        ),
        true,
      );
      await page.locator("#backup-preview summary").click();
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
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        // Theme changes revoke configuration-bound previews. Refresh through
        // the real import control before taking each layout snapshot.
        if (!(await page.locator("#backup-preview").isVisible())) {
          await page.locator("#backup-import").click();
          await page.locator("#backup-preview").waitFor({ state: "visible" });
        }
        await page.screenshot({
          path: join(output, `backup-${width}-${theme}.png`),
          animations: "disabled",
        });
      }
      await page.locator("#backup-cancel").click();
      await page.locator("#backup-preview").waitFor({ state: "hidden" });
    },
  );
  await run(
    "confirmed restore restarts and applies metadata while retaining session and private identity",
    async () => {
      const preview = await command("preview");
      assert.equal(preview.ok, true);
      const exited = new Promise((r) => client.process().once("exit", r));
      await command("restore", { token: preview.preview.token }).catch(
        () => {},
      );
      await exited;
      client = undefined;
      assert.equal(await readFile(join(root, "relaunch"), "utf8"), "yes");
      await launch();
      const s = await state();
      assert.equal(
        s.accounts.find((a) => a.id === "zalo").name,
        "RESTORED_NAME",
      );
      assert.equal(s.presentation.theme, "dark");
      assert.equal(s.privateSpace.unlocked, false);
      assert.equal(JSON.stringify(s).includes("PRIVATE_BACKUP_SECRET"), false);
      assert.equal((await view("zalo")).stored, "KEEP_SESSION");
      const catalog = JSON.parse(
        await readFile(join(root, "TinNhanDesktop", "accounts.json"), "utf8"),
      );
      assert.equal(
        catalog.accounts.find((a) => a.id === privateId).private,
        true,
      );
      const names = await readdir(
        join(root, "TinNhanDesktop", "configuration-backups"),
      );
      assert.ok(names.some((n) => n.endsWith(".gom-config.json")));
      await assert.rejects(
        readFile(
          join(root, "TinNhanDesktop", "configuration-restore.pending.json"),
        ),
      );
    },
  );
  assert.deepEqual(errors, []);
  console.log(`${checks.length} backup checks passed`);
} finally {
  if (client) await quit().catch(() => client?.close());
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await rm(root, { recursive: true, force: true });
}
