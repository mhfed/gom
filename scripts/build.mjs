import { build } from "esbuild";
import { mkdir, copyFile, cp, readFile } from "node:fs/promises";
const automaticUpdatesSupported = Boolean(
  (process.platform === "win32" &&
    process.env.npm_lifecycle_event === "build:win") ||
  (process.platform === "darwin" &&
    process.env.GOM_MACOS_SIGNING_IDENTITY?.trim() &&
    process.env.GOM_APPLE_ID?.trim() &&
    process.env.GOM_APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.GOM_APPLE_TEAM_ID?.trim()),
);
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
    define: {
      "process.env.GOM_AUTOMATIC_UPDATES_ENABLED": JSON.stringify(
        automaticUpdatesSupported ? "true" : "false",
      ),
    },
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
  copyFile("assets/gom-mark.svg", "dist/gom-mark.svg"),
]);

const { default: sharp } = await import("sharp");
await sharp(await readFile("assets/app.svg"))
  .png()
  .toFile("dist/app.png");
await sharp(await readFile("assets/gom-mark.svg"))
  .resize(36, 36)
  .tint("#000000")
  .png()
  .toFile("dist/trayTemplate.png");
