// Run native Electron: Playwright's focus/background switches invalidate this check.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin")
  throw Error("IME native check requires macOS");
const project = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  if (!args[at + 1] || args[at + 1].startsWith("--"))
    throw Error(`Missing value for ${name}`);
  return args[at + 1];
}
const dist = resolve(option("--dist", join(project, "dist")));
const output = resolve(option("--output", join(project, "outputs/ime-check")));
await access(join(dist, "main.cjs"));
await mkdir(output, { recursive: true });
const python = `import ctypes,subprocess,re,json
c=ctypes.CDLL('/System/Library/Frameworks/Carbon.framework/Carbon')
c.IsSecureEventInputEnabled.restype=ctypes.c_bool
s=subprocess.run(['/usr/sbin/ioreg','-l','-d','1','-w','0'],capture_output=True,text=True,check=True).stdout
print(json.dumps({'enabled':c.IsSecureEventInputEnabled(),'pids':re.findall(r'"kCGSSessionSecureInputPID"\\s*=\\s*(\\d+)',s)}))`;
const systemState = () =>
  JSON.parse(
    execFileSync("/usr/bin/python3", ["-c", python], { encoding: "utf8" }),
  );
const before = systemState();
assert.equal(
  before.enabled,
  false,
  "Another process already owns Secure Input; close its password field before testing",
);
const root = await mkdtemp(join(tmpdir(), "tinnhan-ime-check-"));
const boot = join(root, "boot.cjs");
await writeFile(
  boot,
  `const fixtureConfig=${JSON.stringify({ root, entry: join(dist, "main.cjs"), python })};\n` +
    (await readFile(new URL("./ime-entry.cjs", import.meta.url), "utf8")),
);
const records = [];
let stderr = "",
  pending = "";
const child = spawn(
  join(
    project,
    "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  ),
  [boot],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const timeout = setTimeout(() => child.kill("SIGTERM"), 90_000);
child.stdout.on("data", (chunk) => {
  pending += chunk;
  let end;
  while ((end = pending.indexOf("\n")) >= 0) {
    const line = pending.slice(0, end);
    pending = pending.slice(end + 1);
    if (!line.startsWith("IME_METRIC ")) continue;
    const record = JSON.parse(line.slice(11));
    records.push(record);
    console.log(
      `${record.pass ? "PASS" : "FAIL"} ${record.label}: secure=${record.system.enabled}, expected=${record.expected}`,
    );
  }
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
try {
  const code = await new Promise((resolveExit, reject) => {
    child.once("exit", resolveExit);
    child.once("error", reject);
  });
  const after = systemState();
  await writeFile(
    join(output, "result.json"),
    JSON.stringify({ dist, before, after, code, records, stderr }, null, 2),
  );
  assert.equal(code, 0, `Native fixture exited ${code}: ${stderr}`);
  assert.equal(after.enabled, false, "Fixture leaked Secure Input after exit");
  assert.ok(records.length >= 25, "Incomplete native scenarios");
  assert.deepEqual(
    records.filter((r) => !r.pass).map((r) => r.label),
    [],
    "Secure Input regression",
  );
  console.log(
    `PASS ${records.length} native IME checks; passwords protected, inactive input released, drafts/sessions/contents preserved`,
  );
} finally {
  clearTimeout(timeout);
  await rm(root, { recursive: true, force: true });
}
