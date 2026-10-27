const { version } = require("./package.json");

// Everything used at runtime is bundled by scripts/build.mjs. Keep an explicit
// list so a local profile, prototype, or unrelated file cannot enter the app.
const runtimePaths = new Set([
  "",
  "/package.json",
  "/dist",
  "/dist/main.cjs",
  "/dist/preload.cjs",
  "/dist/platform-preload.cjs",
  "/dist/shell.js",
  "/dist/index.html",
  "/dist/shell.css",
  "/dist/app.png",
  "/dist/trayTemplate.png",
  "/dist/gom-mark.svg",
  "/dist/logos",
  "/dist/logos/messenger.svg",
  "/dist/logos/telegram.svg",
  "/dist/logos/zalo.png",
  "/dist/logos/SOURCES.md",
]);

module.exports = {
  outDir: "out-release",
  packagerConfig: {
    asar: true,
    osxSign: {
      identity: "-",
      identityValidation: false,
      preAutoEntitlements: false,
      optionsForFile: () => ({ hardenedRuntime: false }),
    },
    appBundleId: "local.mhfed.tinnhan.desktop",
    executableName: "Gom",
    icon: "assets/app.icns",
    ignore: (file) => !runtimePaths.has(file),
    extendInfo: {
      NSCameraUsageDescription: "Dùng camera khi bạn chọn gọi video.",
      NSMicrophoneUsageDescription:
        "Dùng micro khi bạn chọn gọi thoại hoặc video.",
    },
  },
  makers: [
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: (arch) => ({
        name: `Gom-macOS-${arch}-${version}`,
        title: `Gom ${version}`,
        icon: "assets/app.icns",
        format: "ULFO",
        contents: (options) => [
          { x: 192, y: 344, type: "file", path: options.appPath },
          { x: 448, y: 344, type: "link", path: "/Applications" },
          { x: 320, y: 150, type: "file", path: "assets/Mo-Gom.command" },
        ],
      }),
    },
  ],
};
