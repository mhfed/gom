import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await cp("src/renderer/logos", "dist/logos", { recursive: true });
await Promise.all([
  build({
    entryPoints: ["src/main/main.ts"],
    outfile: "dist/main.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
  }),
  build({
    entryPoints: ["src/main/preload.ts"],
    outfile: "dist/preload.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
  }),
  build({
    entryPoints: ["src/renderer/shell.ts"],
    outfile: "dist/shell.js",
    bundle: true,
    platform: "browser",
    format: "iife",
  }),
  ...["index.html", "shell.css"].map((file) =>
    copyFile("src/renderer/" + file, "dist/" + file),
  ),
]);
