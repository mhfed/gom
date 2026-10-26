import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir, cpus, totalmem, release } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";

// Uses native Electron: Playwright's Electron loader disables background throttling.
const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`Usage:
  node scripts/performance-check.mjs --dist <build-directory> --label before
  node scripts/performance-check.mjs --dist <build-directory> --label after
  node scripts/performance-check.mjs --compare <before.json> <after.json>

Options:
  --label <name>        Output filename without .json (compare default: comparison)
  --output <directory>  Results folder (default outputs/performance-comparison)
  --repeats <count>     Repeats per scenario (default 2)
  --warmup-ms <ms>      Warmup before measuring (default 32000)
  --sample-ms <ms>      Sample duration (default 20400)
  --shown              Also sample with the window shown (not guaranteed foreground)
  --activity           Add a separate login animation workload
  --only-activity      Measure only the login animation workload

Run on a quiet host, sequentially with other GUI tests. Uses temporary fake
profiles; no personal sessions or live provider pages. Build first: this script
never rebuilds or modifies the input build. Run both sides with identical options.`);
  process.exit(0);
}
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const numberOption = (name, fallback, minimum) => {
  const value = Number(option(name, fallback));
  assert(Number.isFinite(value) && value >= minimum, `invalid ${name}`);
  return value;
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const output = resolve(
  option("--output", join(repo, "outputs/performance-comparison")),
);
await mkdir(output, { recursive: true });

if (args.includes("--compare")) {
  const index = args.indexOf("--compare");
  const [beforePath, afterPath] = args.slice(index + 1, index + 3);
  assert(beforePath && afterPath, "--compare requires before.json after.json");
  const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
  const after = JSON.parse(await readFile(resolve(afterPath), "utf8"));
  assert.deepEqual(
    before.settings,
    after.settings,
    "measurement settings must match",
  );
  assert.deepEqual(before.host, after.host, "measurement hosts must match");
  for (const report of [before, after]) {
    const expectedScenarios =
      (report.settings.onlyActivity ? 0 : 4) +
      (report.settings.includeActivity || report.settings.onlyActivity ? 1 : 0);
    assert.equal(
      report.results.length,
      expectedScenarios * report.settings.repeats,
      `${report.label}: incomplete measurement run`,
    );
    for (const result of report.results) {
      assert.equal(
        result.preservation.passed,
        true,
        "preservation check failed",
      );
      assert.equal(
        result.phases.length,
        report.settings.includeShown ? 2 : 1,
        "missing measurement phase",
      );
    }
  }
  const flatten = (report) =>
    report.results.flatMap((result) =>
      result.phases.map((phase) => ({ ...phase, scenario: result.scenario })),
    );
  const a = flatten(before),
    b = flatten(after);
  const keys = [
    ...new Set(a.map((sample) => `${sample.scenario}/${sample.name}`)),
  ];
  assert.deepEqual(keys, [
    ...new Set(b.map((sample) => `${sample.scenario}/${sample.name}`)),
  ]);
  const fields = [
    "sends",
    "changedStateSends",
    "payloadBytes",
    "shellMutations",
    "evaluationCount",
    "workingSetMiB",
    "cpuPercentSum",
    "idleWakeupsPerSec",
    "unthrottledViews",
    "activityFrames",
  ];
  const comparison = {
    date: new Date().toISOString(),
    before: resolve(beforePath),
    after: resolve(afterPath),
    settings: before.settings,
    caveats: before.caveats,
    results: keys.map((key) => {
      const select = (samples) =>
        samples.filter((sample) => `${sample.scenario}/${sample.name}` === key);
      const old = select(a),
        next = select(b);
      assert.equal(old.length, next.length, "sample counts must match");
      assert.equal(
        old.length,
        before.settings.repeats,
        "missing scenario repeat",
      );
      return {
        key,
        repeats: old.length,
        metrics: Object.fromEntries(
          fields.map((field) => {
            const beforeMedian = median(old.map((sample) => sample[field]));
            const afterMedian = median(next.map((sample) => sample[field]));
            return [
              field,
              {
                beforeMedian,
                afterMedian,
                delta: afterMedian - beforeMedian,
                changePercent:
                  beforeMedian === 0
                    ? null
                    : (afterMedian / beforeMedian - 1) * 100,
                beforeSamples: old.map((sample) => sample[field]),
                afterSamples: next.map((sample) => sample[field]),
              },
            ];
          }),
        ),
      };
    }),
  };
  const label = option("--label", "comparison");
  assert(/^[a-z0-9_-]+$/i.test(label), "invalid label");
  const path = join(output, label + ".json");
  await writeFile(path, JSON.stringify(comparison, null, 2) + "\n");
  console.log(JSON.stringify(comparison, null, 2));
  console.log(`DONE ${path}`);
} else {
  const electron = require("electron");
  const dist = resolve(option("--dist", join(repo, "dist")));
  const label = option("--label", "current");
  assert(/^[a-z0-9_-]+$/i.test(label), "invalid label");
  await readFile(join(dist, "main.cjs"));
  const settings = {
    repeats: numberOption("--repeats", 2, 1),
    warmupMs: numberOption("--warmup-ms", 32000, 0),
    sampleMs: numberOption("--sample-ms", 20400, 1000),
    includeShown: args.includes("--shown"),
    includeActivity: args.includes("--activity"),
    onlyActivity: args.includes("--only-activity"),
  };
  const build = {};
  for (const name of [
    "main.cjs",
    "preload.cjs",
    "platform-preload.cjs",
    "shell.js",
    "shell.css",
    "index.html",
  ]) {
    const contents = await readFile(join(dist, name));
    build[name] = {
      bytes: contents.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  }
  assert(Number.isInteger(settings.repeats), "repeats must be an integer");
  const scenarios = settings.onlyActivity
    ? []
    : [
        { name: "authenticated-3", count: 3, login: false },
        { name: "authenticated-6", count: 6, login: false },
        { name: "authenticated-12", count: 12, login: false },
        { name: "login-3", count: 3, login: true },
      ];
  if (settings.includeActivity || settings.onlyActivity)
    scenarios.push({
      name: "login-activity-3",
      count: 3,
      login: true,
      activity: true,
    });
  const report = {
    date: new Date().toISOString(),
    label,
    dist,
    build,
    settings,
    host: {
      model: cpus()[0]?.model,
      logicalCpus: cpus().length,
      ramGiB: totalmem() / 2 ** 30,
      osRelease: release(),
    },
    method:
      "Native Electron executable; no Playwright, remote debugger, forced GC, or background-throttling overrides. Unique temporary appData/home; HTTPS protocol serves local fixtures. 100 fake conversation rows/account. CPU interval starts with getAppMetrics reset. Samples exclude preservation checks. Optional animation is a separate synthetic workload.",
    caveats: [
      "Summed working sets may count shared memory repeatedly; this is not private footprint.",
      "Static fixtures do not reproduce real provider JavaScript, messages, calls, network, battery or long-session leaks.",
      "Window shown does not establish foreground/unoccluded state on macOS; each page visibility is recorded.",
      "executeJavaScript durations include IPC and scheduling; they are not CPU time.",
      "Short low-load CPU samples are noisy; deterministic work counts are stronger evidence than percentage speedups.",
      "Draft and storage assertions cover transitions within the running app; no claim is made that unsaved drafts survive app restart.",
    ],
    results: [],
  };
  for (let repeat = 1; repeat <= settings.repeats; repeat++) {
    // Rotate order on repeat two so warm host effects do not always align with size.
    const ordered = repeat % 2 === 0 ? [...scenarios].reverse() : scenarios;
    for (const scenario of ordered) {
      const root = await mkdtemp(join(tmpdir(), "tn-native-perf-"));
      try {
        const providers = ["zalo", "messenger", "telegram"];
        const accounts = Array.from({ length: scenario.count }, (_, i) => ({
          id: i < 3 ? providers[i] : "acc_" + randomUUID(),
          provider: providers[i % 3],
          name: "Fixture " + (i + 1),
          avatar: "F",
          archived: false,
        }));
        await mkdir(join(root, "TinNhanDesktop"), { recursive: true });
        await writeFile(
          join(root, "TinNhanDesktop", "accounts.json"),
          JSON.stringify({ version: 1, accounts }),
        );
        const rows = Array.from(
          { length: 100 },
          (_, i) =>
            `<div role="row" class="chatlist-chat"><a data-peer-id="${i}">Fixture conversation ${i}</a><span>Offline test content</span></div>`,
        ).join("");
        const body = scenario.login
          ? '<input type="password"><div class="auth-qr-form">Log in by QR Code</div>'
          : '<h1>Chats</h1><button aria-label="New message">New message</button><input id="contact-search-input"><div class="chatlist">' +
            rows +
            '</div><div role="tab">Unread<span class="badge">7</span></div><div class="z-noti-badge-container"><i class="fa-Message_28_Filled"></i><span data-count="7"></span></div>';
        const activity = scenario.activity
          ? `<div id="moving" style="width:30px;height:30px;background:blue"></div><script>window.__activityFrames=0;function frame(){window.__activityFrames++;let value=0;for(let i=0;i<30000;i++)value+=Math.sqrt(i+window.__activityFrames);window.__activityValue=value;document.getElementById('moving').style.transform='translateX('+(window.__activityFrames%100)+'px)';requestAnimationFrame(frame)}requestAnimationFrame(frame)</script>`
          : "";
        const html =
          '<!doctype html><title>(7) Messenger</title><body style="margin:0;background:#fff;height:100vh">' +
          body +
          '<textarea id="draft"></textarea>' +
          activity +
          "</body>";
        const config = {
          root,
          dist,
          scenario,
          repeat,
          settings,
          accounts,
          html,
        };
        const boot = join(root, "bootstrap.cjs");
        await writeFile(
          boot,
          `(${nativeBootstrap.toString()})(${JSON.stringify(config)});`,
        );
        console.log(
          `START ${label} ${scenario.name} repeat ${repeat}/${settings.repeats}`,
        );
        let stderr = "";
        const status = await new Promise((resolveStatus, reject) => {
          const child = spawn(electron, [boot], {
            stdio: ["ignore", "pipe", "pipe"],
          });
          let pending = "";
          child.stdout.on("data", (data) => {
            pending += data;
            const lines = pending.split("\n");
            pending = lines.pop();
            for (const line of lines)
              if (line.startsWith("PERF ")) console.log(line);
          });
          child.stderr.on("data", (data) => {
            stderr = (stderr + data).slice(-40000);
          });
          const timeout = setTimeout(
            () => child.kill("SIGTERM"),
            settings.warmupMs +
              settings.sampleMs * (settings.includeShown ? 2 : 1) +
              90000,
          );
          child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once("exit", (code, signal) => {
            clearTimeout(timeout);
            resolveStatus({ code, signal });
          });
        });
        if (status.code !== 0) {
          const diagnostic = await readFile(
            join(root, "error.txt"),
            "utf8",
          ).catch(() => "");
          throw Error(
            `Native fixture failed ${JSON.stringify(status)}\n${diagnostic}\n${stderr}`,
          );
        }
        report.results.push(
          JSON.parse(await readFile(join(root, "result.json"), "utf8")),
        );
        await writeFile(
          join(output, label + ".json"),
          JSON.stringify(report, null, 2) + "\n",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }
  console.log(`DONE ${join(output, label + ".json")}`);
}

// Serialized into a temporary CommonJS entry point executed by Electron itself.
function nativeBootstrap(config) {
  const e = require("electron"),
    fs = require("node:fs/promises"),
    assert = require("node:assert/strict"),
    path = require("node:path");
  const { root, dist, scenario, repeat, settings, accounts, html } = config;
  const started = performance.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  e.app.setPath("appData", root);
  require("node:os").homedir = () => root;
  const original = e.session.fromPartition.bind(e.session),
    seen = new Set();
  e.session.fromPartition = (key, ...args) => {
    const session = original(key, ...args);
    if (!seen.has(key)) {
      seen.add(key);
      session.protocol.handle(
        "https",
        () => new Response(html, { headers: { "content-type": "text/html" } }),
      );
      session.protocol.handle(
        "http",
        () => new Response("Offline fixture", { status: 404 }),
      );
    }
    return session;
  };
  const a = {
    collecting: false,
    sends: 0,
    changes: 0,
    bytes: 0,
    lastState: "",
    calls: {},
    bounds: 0,
    visibility: 0,
  };
  for (const [method, key] of [
    ["setBounds", "bounds"],
    ["setVisible", "visibility"],
  ]) {
    const fn = e.WebContentsView.prototype[method];
    e.WebContentsView.prototype[method] = function (...args) {
      if (a.collecting) a[key]++;
      return fn.apply(this, args);
    };
  }
  e.app.on("web-contents-created", (_event, contents) => {
    const send = contents.send.bind(contents);
    contents.send = (channel, ...args) => {
      if (channel === "state") {
        const json = JSON.stringify(args[0]);
        if (a.collecting) {
          a.sends++;
          a.bytes += Buffer.byteLength(json);
          if (json !== a.lastState) a.changes++;
        }
        a.lastState = json;
      }
      return send(channel, ...args);
    };
    const execute = contents.executeJavaScript.bind(contents);
    contents.executeJavaScript = async (code, ...args) => {
      const kind = code.includes("tin-nhan:page-snapshot")
        ? "snapshot"
        : code.includes("const votes = new Map")
          ? "theme"
          : code.includes("const text=")
            ? "auth"
            : code.includes("const host=")
              ? "unread"
              : "other";
      const collect = a.collecting && kind !== "other",
        start = performance.now();
      // Count when submitted, and retain the matching interval record across awaits.
      const record = collect
        ? (a.calls[kind] ??= { count: 0, totalMs: 0, maxMs: 0 })
        : null;
      if (record) record.count++;
      try {
        return await execute(code, ...args);
      } finally {
        if (record) {
          const elapsed = performance.now() - start;
          record.totalMs += elapsed;
          record.maxMs = Math.max(record.maxMs, elapsed);
        }
      }
    };
  });
  require(path.join(dist, "main.cjs"));
  e.app.whenReady().then(async () => {
    try {
      const deadline = Date.now() + 30000;
      while (true) {
        const state = a.lastState ? JSON.parse(a.lastState) : null;
        if (
          state &&
          state.accounts.length === scenario.count &&
          state.accounts.every(
            (account) =>
              state.statuses[account.id] ===
              (scenario.login ? "needs-login" : "authenticated"),
          )
        )
          break;
        if (Date.now() > deadline) throw Error("fixture readiness timeout");
        await sleep(50);
      }
      const win = e.BrowserWindow.getAllWindows()[0],
        shell = win.webContents;
      const views = () =>
        win.contentView.children.filter(
          (view) => view.webContents && !view.webContents.isDestroyed(),
        );
      const result = {
        scenario: scenario.name,
        count: scenario.count,
        login: scenario.login,
        activity: !!scenario.activity,
        repeat,
        readyFromBootstrapMs: performance.now() - started,
        phases: [],
        preservation: {},
      };
      const markerFor = (view) => "fixture-preserve-" + view.webContents.id;
      async function preserveSeed() {
        for (const view of views()) {
          const marker = markerFor(view);
          await view.webContents.session.cookies.set({
            url: view.webContents.getURL(),
            name: "fixture-preservation",
            value: marker,
            secure: true,
            httpOnly: true,
            expirationDate: Date.now() / 1000 + 86400,
          });
          await view.webContents.executeJavaScript(
            `(async()=>{const marker=${JSON.stringify(marker)};document.querySelector('#draft').value=marker;window.__draftMarker=marker;localStorage.setItem('fixture-preservation',marker);await new Promise((resolve,reject)=>{const request=indexedDB.open('performance-preservation',1);request.onupgradeneeded=()=>request.result.createObjectStore('markers');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('markers','readwrite');tx.objectStore('markers').put(marker,'value');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});return true})()`,
          );
        }
      }
      async function preserveRead() {
        const read = [];
        for (const view of views()) {
          const storage = await view.webContents.executeJavaScript(
            `(async()=>({draft:document.querySelector('#draft')?.value,memory:window.__draftMarker,local:localStorage.getItem('fixture-preservation'),indexed:await new Promise((resolve,reject)=>{const request=indexedDB.open('performance-preservation',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('markers');const get=tx.objectStore('markers').get('value');get.onsuccess=()=>resolve(get.result??null);get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close()}})}))()`,
          );
          const cookie = (
            await view.webContents.session.cookies.get({
              name: "fixture-preservation",
            })
          )[0]?.value;
          read.push({
            id: view.webContents.id,
            url: view.webContents.getURL(),
            cookie,
            ...storage,
          });
        }
        return read.sort((left, right) => left.id - right.id);
      }
      await preserveSeed();
      const preservedBefore = await preserveRead();
      assert.equal(preservedBefore.length, scenario.count);
      for (const value of preservedBefore)
        for (const key of ["cookie", "draft", "memory", "local", "indexed"])
          assert.equal(value[key], "fixture-preserve-" + value.id);
      await sleep(settings.warmupMs);
      await shell.executeJavaScript(
        "window.__mutations=0;new MutationObserver(records=>window.__mutations+=records.length).observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});true",
      );
      async function frames() {
        return (
          await Promise.all(
            views().map((view) =>
              view.webContents.executeJavaScript("window.__activityFrames||0"),
            ),
          )
        ).reduce((sum, value) => sum + value, 0);
      }
      async function measure(name) {
        await shell.executeJavaScript("window.__mutations=0");
        const startFrames = await frames();
        Object.assign(a, {
          sends: 0,
          changes: 0,
          bytes: 0,
          calls: {},
          bounds: 0,
          visibility: 0,
          collecting: true,
        });
        const begin = performance.now();
        e.app.getAppMetrics();
        await sleep(settings.sampleMs);
        a.collecting = false;
        const metrics = e.app.getAppMetrics(),
          currentViews = views();
        const sample = {
          name,
          elapsedMs: performance.now() - begin,
          windowVisible: win.isVisible(),
          sends: a.sends,
          changedStateSends: a.changes,
          payloadBytes: a.bytes,
          execute: a.calls,
          evaluationCount: Object.values(a.calls).reduce(
            (sum, entry) => sum + entry.count,
            0,
          ),
          boundsCalls: a.bounds,
          visibilityCalls: a.visibility,
          processCount: metrics.length,
          workingSetMiB:
            metrics.reduce(
              (sum, metric) => sum + metric.memory.workingSetSize,
              0,
            ) / 1024,
          cpuPercentSum: metrics.reduce(
            (sum, metric) => sum + metric.cpu.percentCPUUsage,
            0,
          ),
          idleWakeupsPerSec: metrics.reduce(
            (sum, metric) => sum + metric.cpu.idleWakeupsPerSecond,
            0,
          ),
          viewCount: currentViews.length,
          unthrottledViews: currentViews.filter(
            (view) => !view.webContents.getBackgroundThrottling(),
          ).length,
          processes: metrics.map((metric) => ({
            type: metric.type,
            name: metric.name,
            workingSetMiB: metric.memory.workingSetSize / 1024,
            cpuPercent: metric.cpu.percentCPUUsage,
          })),
        };
        sample.shellMutations =
          await shell.executeJavaScript("window.__mutations");
        sample.activityFrames = (await frames()) - startFrames;
        sample.visibilityStates = await Promise.all(
          currentViews.map(async (view) => ({
            nativeVisible: view.getVisible(),
            pageVisibility: await view.webContents.executeJavaScript(
              "document.visibilityState",
            ),
          })),
        );
        result.phases.push(sample);
        console.log(
          "PERF " +
            JSON.stringify({
              scenario: scenario.name,
              repeat,
              ...sample,
              processes: undefined,
              visibilityStates: undefined,
            }),
        );
      }
      if (settings.includeShown) await measure("shown");
      win.hide();
      await sleep(800);
      await measure("hidden");
      assert.deepEqual(
        await preserveRead(),
        preservedBefore,
        "hidden sample must preserve sessions and drafts",
      );
      win.show();
      if (scenario.activity) {
        // Outside the measurement window: prove throttling permits foreground
        // animation to resume, without replacing/reloading the account view.
        win.focus();
        e.app.focus({ steal: true });
        const active = views().find((view) => view.getVisible());
        assert(active, "missing visible account view");
        active.webContents.focus();
        const deadline = Date.now() + 5000;
        let firstVisibleFrames = null;
        let observed = null;
        while (Date.now() < deadline) {
          observed = await active.webContents.executeJavaScript(
            "({visibility:document.visibilityState,frames:window.__activityFrames||0})",
          );
          if (observed.visibility === "visible") {
            if (firstVisibleFrames === null)
              firstVisibleFrames = observed.frames;
            else if (observed.frames > firstVisibleFrames) break;
          }
          await sleep(100);
        }
        result.foregroundResume = {
          windowVisible: win.isVisible(),
          windowFocused: win.isFocused(),
          webContentsId: active.webContents.id,
          documentVisibility: observed?.visibility,
          firstVisibleFrames,
          finalFrames: observed?.frames,
          confirmed:
            firstVisibleFrames !== null &&
            observed?.visibility === "visible" &&
            observed.frames > firstVisibleFrames,
        };
        console.log("PERF RESUME " + JSON.stringify(result.foregroundResume));
      }
      await sleep(100);
      for (const account of accounts)
        await shell.executeJavaScript(
          "window.desktop.activate(" + JSON.stringify(account.id) + ")",
        );
      win.hide();
      await sleep(100);
      win.show();
      await sleep(100);
      assert.deepEqual(
        await preserveRead(),
        preservedBefore,
        "account switches and visibility changes must preserve sessions and drafts",
      );
      result.preservation = {
        passed: true,
        accountsChecked: preservedBefore.length,
        checks: [
          "cookie",
          "localStorage",
          "IndexedDB",
          "draft textarea",
          "draft JS memory",
          "webContents identity",
          "page URL",
        ],
        transitions: [
          "warmup",
          "periodic probes",
          "hide",
          "show",
          "activate every account",
        ],
      };
      await fs.writeFile(
        path.join(root, "result.json"),
        JSON.stringify(result),
      );
      e.app.quit();
    } catch (error) {
      console.error(error);
      await fs.writeFile(
        path.join(root, "error.txt"),
        String(error.stack || error),
      );
      e.app.exit(1);
    }
  });
}
