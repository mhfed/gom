const { version } = require("./package.json");
const signingIdentity = process.env.GOM_MACOS_SIGNING_IDENTITY?.trim();
const appleId = process.env.GOM_APPLE_ID?.trim();
const appleIdPassword = process.env.GOM_APPLE_APP_SPECIFIC_PASSWORD;
const appleTeamId = process.env.GOM_APPLE_TEAM_ID?.trim();
const canNotarize = Boolean(appleId && appleIdPassword && appleTeamId);

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
  "/dist/logos/gmail.svg",
  "/dist/logos/instagram.svg",
  "/dist/logos/discord.svg",
  "/dist/logos/slack.svg",
  "/dist/logos/tinder.svg",
  "/dist/logos/zalo.png",
  "/dist/logos/SOURCES.md",
]);

module.exports = {
  outDir: "out-release",
  packagerConfig: {
    asar: true,
    osxSign: signingIdentity
      ? {
          identity: signingIdentity,
          optionsForFile: () => ({ hardenedRuntime: true }),
        }
      : {
          identity: "-",
          identityValidation: false,
          preAutoEntitlements: false,
          optionsForFile: () => ({ hardenedRuntime: false }),
        },
    ...(signingIdentity && canNotarize
      ? {
          osxNotarize: {
            appleId,
            appleIdPassword,
            teamId: appleTeamId,
          },
        }
      : {}),
    appBundleId: "local.mhfed.tinnhan.desktop",
    executableName: "Gom",
    icon: process.platform === "win32" ? "assets/app.ico" : "assets/app.icns",
    ignore: (file) => !runtimePaths.has(file),
    extendInfo: {
      NSCameraUsageDescription: "Dùng camera khi bạn chọn gọi video.",
      NSMicrophoneUsageDescription:
        "Dùng micro khi bạn chọn gọi thoại hoặc video.",
      NSLocationUsageDescription:
        "Tinder dùng vị trí khi bạn chọn tìm người phù hợp gần mình.",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "Gom_win32_x64",
        authors: "Gom",
        description: "Không gian trò chuyện gọn một nơi.",
        setupExe: `Gom-win32-x64-${version}-Setup.exe`,
        setupIcon: "assets/app.ico",
        noMsi: true,
      },
    },
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
