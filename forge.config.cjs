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
    executableName: "Tin Nhan",
    icon: "assets/app.icns",
    ignore: [
      /^\/src(?:\/|$)/,
      /^\/tests(?:\/|$)/,
      /^\/scripts(?:\/|$)/,
      /^\/out(?:\/|$)/,
      /^\/out-release(?:\/|$)/,
      /^\/node_modules(?:\/|$)/,
      /^\/\.git(?:\/|$)/,
    ],
    extendInfo: {
      NSCameraUsageDescription: "Dùng camera khi bạn chọn gọi video.",
      NSMicrophoneUsageDescription:
        "Dùng micro khi bạn chọn gọi thoại hoặc video.",
    },
  },
  makers: [{ name: "@electron-forge/maker-zip", platforms: ["darwin"] }],
};
