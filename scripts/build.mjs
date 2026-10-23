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
    entryPoints: ["src/main/platform-preload.ts"],
    outfile: "dist/platform-preload.cjs",
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

const { default: sharp } = await import("sharp");
await sharp(
  Buffer.from(
    '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><path d="M7 6h22a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H17l-9 6v-6H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="none" stroke="black" stroke-width="3" stroke-linejoin="round"/><circle cx="12" cy="16" r="2"/><circle cx="18" cy="16" r="2"/><circle cx="24" cy="16" r="2"/></svg>',
  ),
)
  .png()
  .toFile("dist/trayTemplate.png");
