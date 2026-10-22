import { build } from "esbuild";
import { spawn } from "node:child_process";
import { readFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const electron = require("electron");
const root = resolve("../persistence-fixture");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await build({
  entryPoints: ["scripts/persistence-entry.ts"],
  outfile: root + "/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
for (const phase of ["write", "read"]) {
  const code = await new Promise((resolve, reject) => {
    const proc = spawn(electron, [root + "/main.cjs"], {
      env: { ...process.env, FIXTURE_ROOT: root, FIXTURE_PHASE: phase },
      stdio: "ignore",
    });
    proc.on("exit", resolve);
    proc.on("error", reject);
  });
  const result = JSON.parse(
    await readFile(root + "/" + phase + ".json", "utf8"),
  );
  console.log(JSON.stringify({ exit: code, ...result }));
  if (code !== 0 || !result.passed) process.exit(1);
}
