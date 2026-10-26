// Run after `npm run build`. All accounts and HTTP pages belong to this fresh
// fixture profile; the GitHub API is stubbed in Node and no browser is opened.
import assert from "node:assert/strict";
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

const project = fileURLToPath(new URL("..", import.meta.url));
const output = join(project, "outputs/manual-updates");
const entry = join(project, "dist/main.cjs");
const version = JSON.parse(
  await readFile(join(project, "package.json"), "utf8"),
).version;
const [major, minor, patch] = version.split(".").map(Number);
const newerVersion = `${major}.${minor}.${patch + 1}`;
await access(entry);
const root = await mkdtemp(join(tmpdir(), "tin-nhan-manual-updates-"));
const bootstrap = join(root, "bootstrap.cjs");
const releaseUrl = "https://github.com/mhfed/tin-nhan-desktop/releases";
const cases = [];
const errors = [];
let client;
let page;
let baseline;
let firstRunRequests = 0;
const notes =
  '<img src=x onerror="window.fixtureInjected=true">\nBản mới giả lập; không có tệp được tải.';
const fixtureHTML = `<!doctype html><html lang="vi" data-update-fixture="true"><meta charset="utf-8"><body><h1>Trang chat giả lập</h1><input id="contact-search-input"><div class="chatlist"><a data-peer-id="fixture"></a></div><button aria-label="New message">New message</button><textarea id="draft" aria-label="Bản nháp kiểm thử"></textarea><script>document.documentElement.dataset.documentToken=crypto.randomUUID();</script></body></html>`;
await writeFile(
  bootstrap,
  `
const e = require('electron');
const fs = require('node:fs');
const root = ${JSON.stringify(root)};
const currentVersion = ${JSON.stringify(version)};
e.app.setPath('appData', root);
e.app.getVersion = () => currentVersion;
require('node:os').homedir = () => root;
e.app.on('before-quit', () => fs.appendFileSync(require('node:path').join(root, 'normal-quits.txt'), 'quit\\n'));
const fixture = globalThis.manualUpdatesFixture = {
  requests: [], opens: [], unexpected: [], sessions: new Map(), pages: {},
  mode: { kind: 'release', version: ${JSON.stringify(newerVersion)}, arch: process.arch, notes: ${JSON.stringify(notes)} },
  hold: false, release: null, handler: null
};
e.shell.openExternal = async (url) => { fixture.opens.push(url); };
e.dialog.showMessageBox = async () => ({ response: 0 });
const handle = e.ipcMain.handle.bind(e.ipcMain);
e.ipcMain.handle = (channel, listener) => {
  if (channel === 'desktop') fixture.handler = listener;
  return handle(channel, listener);
};
globalThis.fetch = async (url, init) => {
  if (url !== 'https://api.github.com/repos/mhfed/tin-nhan-desktop/releases/latest') {
    fixture.unexpected.push(String(url));
    throw Error('Unexpected network request');
  }
  const headers = new Headers(init?.headers);
  fixture.requests.push({ url, credentials: init?.credentials, redirect: init?.redirect,
    auth: headers.has('authorization'), cookies: headers.has('cookie') });
  if (fixture.hold) await new Promise(resolve => { fixture.release = resolve; });
  const mode = fixture.mode;
  if (mode.kind === 'offline') throw new TypeError('Fixture offline');
  if (mode.kind === 'http') return new Response('{}', { status: mode.status });
  const tag = 'v' + mode.version;
  const name = 'Gom-macOS-' + mode.arch + '-' + mode.version + '.dmg';
  return new Response(JSON.stringify({ tag_name: tag, prerelease: false, draft: false,
    html_url: mode.kind === 'spoof' ? 'https://github.com.evil.example/mhfed/tin-nhan-desktop/releases/tag/' + tag : ${JSON.stringify(releaseUrl)} + '/tag/' + tag,
    body: mode.notes ?? 'Ghi chú kiểm thử.',
    assets: [{ name, browser_download_url: ${JSON.stringify(releaseUrl)} + '/download/' + tag + '/' + name }]
  }), { headers: { 'content-type': 'application/json' } });
};
const fromPartition = e.session.fromPartition.bind(e.session);
e.session.fromPartition = (...args) => {
  const ses = fromPartition(...args);
  if (!fixture.sessions.has(ses)) {
    const partition = args[0];
    fixture.sessions.set(ses, partition);
    fixture.pages[partition] = 0;
    const respond = () => {
      fixture.pages[partition]++;
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

async function launch() {
  client = await _electron.launch({
    executablePath: join(
      project,
      "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    ),
    args: ["--use-mock-keychain", bootstrap],
    timeout: 20000,
  });
  page = await client.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(
    () => typeof window.desktop?.checkUpdates === "function",
  );
  assert.equal(
    await client.evaluate(({ app }) => app.getPath("userData")),
    join(root, "TinNhanDesktop"),
  );
  assert.equal(await client.evaluate(({ app }) => app.isPackaged), false);
  assert.deepEqual((await state()).profiles, []);
}
const state = () => page.evaluate(() => window.desktop.state());
async function eventually(label, predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw Error(`Timed out: ${label}`);
}
const requests = () =>
  client.evaluate(() => globalThis.manualUpdatesFixture.requests.length);
async function mode(value) {
  await client.evaluate((_electron, value) => {
    globalThis.manualUpdatesFixture.mode = value;
  }, value);
}
async function views() {
  return client.evaluate(async ({ BrowserWindow }) => {
    const fixture = globalThis.manualUpdatesFixture;
    return Promise.all(
      BrowserWindow.getAllWindows()[0].contentView.children.map(
        async (view) => ({
          id: view.webContents.id,
          partition: fixture.sessions.get(view.webContents.session),
          requests:
            fixture.pages[fixture.sessions.get(view.webContents.session)],
          visible: view.getVisible(),
          ...(await view.webContents.executeJavaScript(
            `({fixture:document.documentElement.dataset.updateFixture==='true',token:document.documentElement.dataset.documentToken,draft:document.querySelector('#draft')?.value})`,
          )),
        }),
      ),
    );
  });
}
async function preserved() {
  const current = await views();
  assert.equal(current.length, baseline.length);
  for (const before of baseline) {
    const after = current.find((view) => view.partition === before.partition);
    for (const key of [
      "id",
      "partition",
      "requests",
      "token",
      "draft",
      "fixture",
    ])
      assert.equal(
        after?.[key],
        before[key],
        `${before.partition}: ${key} changed`,
      );
  }
}
async function check(name, run) {
  await client.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });
  await run();
  cases.push(name);
  console.log(`PASS ${name}`);
}
async function checkPhase(expected) {
  await page.locator("#check-updates").click();
  await eventually(
    `update phase ${expected}`,
    async () => (await state()).updates.phase === expected,
  );
  assert.equal(
    await page.locator("#update-message").getAttribute("data-phase"),
    expected,
  );
  assert.equal(
    await page.locator("#download-update").isVisible(),
    expected === "available",
  );
  assert.equal(
    await page
      .locator("#settings")
      .evaluate((node) => node.classList.contains("has-update")),
    expected === "available",
  );
}
async function menuCheck() {
  await client.evaluate(({ Menu }) => {
    const item = Menu.getApplicationMenu()
      .items.flatMap((item) => item.submenu?.items ?? [])
      .find((item) => item.label === "Kiểm tra cập nhật…");
    if (!item) throw Error("Update menu item missing");
    item.click();
  });
}
async function closeNormally() {
  await client.close();
  client = null;
}

try {
  await launch();
  await mkdir(output, { recursive: true });
  await check(
    "development startup never schedules an automatic update request",
    async () => {
      assert.equal((await state()).preferences.updateChecks, true);
      assert.equal((await state()).updates.phase, "idle");
      await eventually("all synthetic pages ready", async () => {
        const all = await views();
        return (
          all.length === 3 && all.every((view) => view.fixture && view.token)
        );
      });
      await client.evaluate(async ({ BrowserWindow }) => {
        for (const view of BrowserWindow.getAllWindows()[0].contentView
          .children)
          await view.webContents.executeJavaScript(
            `document.querySelector('#draft').value='Bản nháp riêng '+${view.webContents.id};`,
          );
      });
      baseline = await views();
      // The production startup delay is 30 seconds. No timing hooks are patched.
      await page.waitForTimeout(31000);
      assert.equal(await requests(), 0);
      assert.equal((await state()).updates.phase, "idle");
      await preserved();
    },
  );

  await check(
    "actual settings bridge coalesces checks and displays safe release notes",
    async () => {
      await page.locator("#settings").click();
      await page.locator('[data-tab="updates"]').click();
      assert.equal(
        await page.locator("#update-current").textContent(),
        version,
      );
      await client.evaluate(() => {
        globalThis.manualUpdatesFixture.hold = true;
      });
      await page.locator("#check-updates").click();
      await eventually("request held", async () => (await requests()) === 1);
      assert.equal((await state()).updates.phase, "checking");
      assert.equal(await page.locator("#check-updates").isDisabled(), true);
      const repeated = page.evaluate(() =>
        Promise.all([
          window.desktop.checkUpdates(),
          window.desktop.checkUpdates(),
        ]),
      );
      await page.waitForTimeout(100);
      assert.equal(await requests(), 1);
      await client.evaluate(() => {
        const f = globalThis.manualUpdatesFixture;
        f.hold = false;
        f.release();
      });
      await repeated;
      await eventually(
        "available update",
        async () => (await state()).updates.phase === "available",
      );
      assert.equal(
        await page.locator("#update-latest").textContent(),
        newerVersion,
      );
      assert.equal(await page.locator("#update-notes").textContent(), notes);
      assert.equal(await page.locator("#update-notes img").count(), 0);
      assert.equal(
        await page.evaluate(() => window.fixtureInjected),
        undefined,
      );
      assert.equal(await page.locator("#download-update").isVisible(), true);
      assert.equal(
        await page
          .locator("#settings")
          .evaluate((node) => node.classList.contains("has-update")),
        true,
      );
      const request = await client.evaluate(
        () => globalThis.manualUpdatesFixture.requests[0],
      );
      assert.equal(request.credentials, "omit");
      assert.equal(request.redirect, "error");
      assert.equal(request.auth, false);
      assert.equal(request.cookies, false);
      assert.ok((await views()).every((view) => !view.visible));
      await page.locator("#update-notes-container summary").click();
      await page.screenshot({ path: join(output, "updates-available.png") });
    },
  );

  await check(
    "download opens only the validated release page and preserves chat drafts",
    async () => {
      await page.locator("#download-update").click();
      await eventually(
        "browser request captured",
        async () =>
          (await client.evaluate(
            () => globalThis.manualUpdatesFixture.opens.length,
          )) === 1,
      );
      // The renderer bridge accepts no URL. Extra JavaScript arguments cannot steer it.
      await page.evaluate(() =>
        window.desktop.openUpdateDownload("https://evil.example"),
      );
      assert.deepEqual(
        await client.evaluate(() => globalThis.manualUpdatesFixture.opens),
        Array(2).fill(`${releaseUrl}/tag/v${newerVersion}`),
      );
      await preserved();
      await page.locator("#platform-zalo").click();
      await eventually(
        "return to chat",
        async () => (await state()).panel === "service",
      );
      assert.equal((await views()).filter((view) => view.visible).length, 1);
      await preserved();
    },
  );

  await check("menu opens updates and native pages remain hidden", async () => {
    const before = await requests();
    await menuCheck();
    await eventually(
      "menu request",
      async () => (await requests()) === before + 1,
    );
    await page.locator("#tab-updates").waitFor({ state: "visible" });
    assert.equal((await state()).panel, "settings");
    assert.ok((await views()).every((view) => !view.visible));
  });

  await check(
    "current, ahead, incompatible, missing, offline and rate-limit states remain truthful",
    async () => {
      const architecture = await client.evaluate(() => process.arch);
      for (const [value, expected] of [
        [{ kind: "release", version, arch: architecture }, "current"],
        [{ kind: "release", version: "0.1.0", arch: architecture }, "ahead"],
        [
          {
            kind: "release",
            version: newerVersion,
            arch: architecture === "arm64" ? "x64" : "arm64",
          },
          "unavailable",
        ],
        [{ kind: "http", status: 404 }, "unavailable"],
        [{ kind: "offline" }, "error"],
        [{ kind: "http", status: 429 }, "error"],
        [{ kind: "spoof", version: newerVersion, arch: architecture }, "error"],
      ]) {
        await mode(value);
        await checkPhase(expected);
        const before = await client.evaluate(
          () => globalThis.manualUpdatesFixture.opens.length,
        );
        await page.evaluate(() => window.desktop.openUpdateDownload());
        assert.equal(
          await client.evaluate(
            () => globalThis.manualUpdatesFixture.opens.length,
          ),
          before,
        );
        assert.equal((await state()).updates.releaseUrl, null);
      }
      await mode({
        kind: "release",
        version: newerVersion,
        arch: architecture,
      });
      await checkPhase("available");
      await preserved();
    },
  );

  await check(
    "untrusted service contents have no update bridge and fail the actual IPC guard",
    async () => {
      const before = await requests();
      const result = await client.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0].contentView.children[0];
        const contents = view.webContents;
        const exposed = await contents.executeJavaScript(
          "({desktop:typeof window.desktop,require:typeof require})",
        );
        const failures = [];
        for (const command of ["updates-check", "updates-download"])
          try {
            await globalThis.manualUpdatesFixture.handler(
              { sender: contents, senderFrame: contents.mainFrame },
              command,
            );
            failures.push("accepted");
          } catch (error) {
            failures.push(error.message);
          }
        return { exposed, failures };
      });
      assert.deepEqual(result.exposed, {
        desktop: "undefined",
        require: "undefined",
      });
      assert.deepEqual(result.failures, ["untrusted", "untrusted"]);
      assert.equal(await requests(), before);
    },
  );

  await check(
    "update menu preserves an unfinished account form and all native drafts",
    async () => {
      await page.locator("#platform-telegram").click();
      await page.locator("#add-account-toolbar").click();
      await page.locator("#account-editor").waitFor({ state: "visible" });
      await page.locator("#account-name").fill("Tên đang soạn, chưa lưu");
      const before = await requests();
      await menuCheck();
      await eventually(
        "check while editing",
        async () =>
          (await requests()) === before + 1 &&
          (await state()).updates.phase === "available",
      );
      assert.equal(await page.locator("#account-editor").isVisible(), true);
      assert.equal(
        await page.locator("#account-name").inputValue(),
        "Tên đang soạn, chưa lưu",
      );
      assert.ok((await views()).every((view) => !view.visible));
      await preserved();
      await page.locator("#account-editor-cancel").click();
      await page.locator('[data-tab="updates"]').click();
    },
  );

  await check(
    "automatic-check preference is saved without restarting the app",
    async () => {
      await page.locator("#auto-check-updates").uncheck();
      await eventually("preference saved", async () => {
        if ((await state()).preferences.updateChecks !== false) return false;
        try {
          return (
            JSON.parse(
              await readFile(join(root, "TinNhanDesktop/window.json"), "utf8"),
            ).preferences.updateChecks === false
          );
        } catch {
          return false;
        }
      });
      await preserved();
      firstRunRequests = await requests();
      assert.deepEqual(
        await client.evaluate(() => globalThis.manualUpdatesFixture.unexpected),
        [],
      );
    },
  );

  await closeNormally();
  assert.match(await readFile(join(root, "normal-quits.txt"), "utf8"), /quit/);
  await launch();
  await check(
    "normal quit and relaunch preserve the disabled automatic-check preference",
    async () => {
      assert.equal((await state()).preferences.updateChecks, false);
      await page.locator("#settings").click();
      await page.locator('[data-tab="updates"]').click();
      assert.equal(
        await page.locator("#auto-check-updates").isChecked(),
        false,
      );
      assert.equal((await state()).updates.phase, "idle");
      assert.equal(await requests(), 0);
      assert.deepEqual(
        await client.evaluate(() => globalThis.manualUpdatesFixture.unexpected),
        [],
      );
    },
  );
  assert.deepEqual(errors, []);
  await closeNormally();
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(
      {
        pass: true,
        checks: cases.length,
        cases,
        version,
        syntheticOnly: true,
        realProfilesAccessed: false,
        requests: firstRunRequests,
        rendererErrors: errors,
        screenshot: "updates-available.png",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS ${cases.length} manual-update integration checks; output: ${output}`,
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
