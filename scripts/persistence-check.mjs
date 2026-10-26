import { build } from "esbuild";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const electron = require("electron");
const root = await mkdtemp(join(tmpdir(), "tin-nhan-persistence-"));
try {
  await build({
    entryPoints: [
      fileURLToPath(new URL("./persistence-entry.ts", import.meta.url)),
    ],
    outfile: join(root, "main.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
  });
  for (const phase of ["write", "read"]) {
    const code = await new Promise((resolve, reject) => {
      const proc = spawn(
        electron,
        ["--use-mock-keychain", join(root, "main.cjs")],
        {
          env: { ...process.env, FIXTURE_ROOT: root, FIXTURE_PHASE: phase },
          stdio: "ignore",
        },
      );
      proc.on("exit", resolve);
      proc.on("error", reject);
    });
    const result = JSON.parse(
      await readFile(join(root, phase + ".json"), "utf8"),
    );
    console.log(JSON.stringify({ exit: code, ...result }));
    if (code !== 0 || !result.passed)
      throw new Error("Persistence fixture failed during " + phase);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
