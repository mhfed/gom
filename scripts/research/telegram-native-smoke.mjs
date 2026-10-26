// Research only: no app imports, Telegram credentials, login, or message requests.
// Install pinned dependencies into a separate temporary directory before running.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
assert.ok(
  args.includes("--deps"),
  "Pass --deps /absolute/temp/dependencies-directory",
);
const deps = resolve(option("--deps"));
assert.notEqual(deps, repo, "Use a separate temporary dependencies directory");
const output = resolve(
  args.includes("--output")
    ? option("--output")
    : join(here, "telegram-native-evidence.json"),
);
const dependencies = createRequire(join(deps, "package.json"));
const pinned = { tdl: "8.1.0", "prebuilt-tdlib": "0.1008069.0" };
for (const [name, version] of Object.entries(pinned)) {
  assert.equal(
    dependencies(`${name}/package.json`).version,
    version,
    `${name} must match the reviewed pin`,
  );
}
const tdlibMetadata = dependencies("prebuilt-tdlib/package.json").tdlib;
const dependencyLock = JSON.parse(
  await readFile(join(deps, "package-lock.json"), "utf8"),
);
const packageIntegrity = Object.fromEntries(
  ["tdl", "prebuilt-tdlib", "@prebuilt-tdlib/darwin-arm64"].map((name) => {
    const entry = dependencyLock.packages[`node_modules/${name}`];
    return [
      name,
      {
        version: entry.version,
        resolved: entry.resolved,
        integrity: entry.integrity,
      },
    ];
  }),
);
const library = dependencies("prebuilt-tdlib").getTdjson();
const addon = join(deps, "node_modules/tdl/prebuilds/darwin-arm64/tdl.node");
const digest = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const fixtureRoot = await mkdtemp(join(tmpdir(), "tin-nhan-telegram-smoke-"));
const mainEntry = join(here, "telegram-native-main.cjs");
const electron = createRequire(join(repo, "package.json"))("electron");
// Deliberately do not inherit possible credential/debug variables from the shell.
const env = Object.fromEntries(
  ["PATH", "TMPDIR", "LANG", "LC_ALL", "__CF_USER_TEXT_ENCODING"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
const child = spawn(electron, [mainEntry, deps, fixtureRoot], {
  cwd: fixtureRoot,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
const deadline = setTimeout(() => child.kill("SIGTERM"), 25000);
const exit = await new Promise((accept, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => accept({ code, signal }));
}).finally(() => clearTimeout(deadline));
const line = stdout
  .split("\n")
  .find((value) => value.startsWith("TELEGRAM_NATIVE_SMOKE "));
const result = line
  ? JSON.parse(line.slice("TELEGRAM_NATIVE_SMOKE ".length))
  : null;
const evidence = {
  checkedAt: new Date().toISOString(),
  scope:
    "Unauthenticated native feasibility only; not a production connector or performance benchmark",
  dependencies: pinned,
  tdlib: tdlibMetadata,
  packageIntegrity,
  binarySha256: { addon: await digest(addon), tdjson: await digest(library) },
  dependencyInstallationIsExternalToProbe: true,
  fixtureRoot,
  exit,
  result,
  stderr: stderr.trim(),
};
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
assert.equal(
  exit.code,
  0,
  `Electron smoke failed: ${stderr || stdout || exit.signal}`,
);
assert.equal(result?.pass, true, "Smoke result must pass");
assert.equal(result.worker.versions.electron, "45.0.0");
assert.equal(result.worker.arch, "arm64");
assert.equal(result.worker.tdlibVersion, tdlibMetadata.version);
console.log(JSON.stringify({ pass: true, output, ...result }, null, 2));
