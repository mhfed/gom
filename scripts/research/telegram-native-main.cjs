// Electron harness, intentionally independent of src/main/main.ts and its profile.
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { app, utilityProcess } = require("electron");
const [deps, root] = process.argv.slice(2);
assert.ok(deps && root, "Only launch through telegram-native-smoke.mjs");
app.setName("TinNhanTelegramResearch");
for (const [key, leaf] of [
  ["appData", "app-data"],
  ["userData", "user-data"],
  ["sessionData", "session-data"],
  ["logs", "logs"],
]) {
  const location = join(root, leaf);
  mkdirSync(location, { recursive: true });
  app.setPath(key, location);
}
let child;
let finished = false;
const deadline = setTimeout(
  () => finish(false, { error: "utility-timeout" }),
  18000,
);
function finish(pass, detail) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  child?.kill();
  console.log(
    "TELEGRAM_NATIVE_SMOKE " +
      JSON.stringify({
        pass,
        appVersions: process.versions,
        isolatedUserData: app.getPath("userData") === join(root, "user-data"),
        ...detail,
      }),
  );
  app.exit(pass ? 0 : 1);
}
app
  .whenReady()
  .then(() => {
    app.dock?.hide();
    child = utilityProcess.fork(
      join(__dirname, "telegram-native-worker.cjs"),
      [resolve(deps)],
      {
        cwd: root,
        serviceName: "Telegram TDLib feasibility",
        stdio: "pipe",
        env: { PATH: process.env.PATH || "/usr/bin:/bin", TMPDIR: root },
      },
    );
    let report;
    let workerStderr = "";
    child.stderr?.on("data", (chunk) => {
      workerStderr += chunk;
    });
    child.on("message", (message) => {
      report = message;
      if (message.pass) child.postMessage("exit-after-tdlib-closed");
    });
    child.on("exit", (code) => {
      const pass = code === 0 && report?.pass === true;
      finish(pass, {
        workerExitCode: code,
        worker: report || null,
        workerStderr: workerStderr.trim(),
      });
    });
  })
  .catch((error) => finish(false, { error: error.message }));
