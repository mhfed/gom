# Gom 0.6.0 — 26/10/2026

Implemented the user-approved Gom name, rounded g/speech-bubble logo and teal/mint/ivory palette. Product name, executable, menu, About panel, notifications, settings and installer now display Gom. The Dock icon, menu-bar template and settings mark share `assets/gom-mark.svg`; `node scripts/icon.mjs` rebuilds the iconset/ICNS. Existing platform tabs, provider pages, account behavior and platform-adaptive theme remain.

## Upgrade compatibility

Bundle ID `local.mhfed.tinnhan.desktop`, `TinNhanDesktop` userData, account IDs and partitions remain. The early `app.setName("Tin Nhan")` is intentionally preserved: Electron 45 derives its macOS Keychain service from this internal name. Changing it to Gom would request another encryption key despite the unchanged profile directory. Verified against [Electron 45 initialization](https://github.com/electron/electron/blob/v45.0.0/shell/browser/electron_browser_main_parts.cc#L613-L655) and [its Keychain patch](https://github.com/electron/electron/blob/v45.0.0/patches/chromium/feat_ensure_mas_builds_of_the_same_application_can_use_safestorage.patch). OS bundle names can be Gom independently.

The updater accepts both Gom and historical installer prefixes with the same exact repository/tag/version/architecture checks. Existing Tin Nhan 0.5.4 cannot recognize Gom filenames; a byte-identical `TinNhan-macOS-arm64-0.6.0.dmg` compatibility alias is included in the public release. Installation instructions explain the new app filename and any old login item. See [distribution](distribution.md).

## Verification

- TypeScript check, build and 128 unit tests passed, including RED/GREEN tests for Gom update recognition and retained legacy/security rules.
- 12 native-tab checks passed: preserved encryption/profile identity, account selection, keyboard navigation, drafts/view identities, focus and layout at 940/1024/1280 widths; unchanged state still causes zero DOM mutations.
- Command-focus checks and 9 update integration checks passed.
- Multi-account migration/restart checks passed for six separate accounts and legacy cookie/localStorage/IndexedDB; persistence write/read passed for all three providers.
- All executed Electron fixtures used temporary data and `--use-mock-keychain`. No personal account or real Keychain data was accessed. The mock cannot verify Keychain-name compatibility by itself; the separate runtime internal-name assertion and source inspection cover that configuration.
- Reviewed the light/dark captures and vector icon. Standard light primary button contrast is 5.18:1; dark button contrast is 9.86:1. Platform-derived backgrounds remain adaptive.
- Fresh independent code/package review found no local-build blocker. The old-updater alias and upgrade-copy findings were addressed.
- `npm run make` passed. Deep/strict ad-hoc signature and ZIP integrity checks passed; metadata names/executable are Gom, version is 0.6.0, architecture arm64, bundle ID unchanged.
- ASAR contains only the allowlisted runtime and pruned package metadata. All 12 runtime files match the current build byte-for-byte, and the bundled Dock icon matches the source ICNS.
- DMG checksum passed; read-only mount confirmed signed `Gom.app`, the `/Applications` link and ASAR matching the local bundle. The volume was detached after verification.
- A separate smoke loaded the packaged ASAR in development Electron using a temporary profile and synthetic provider pages; the Gom menu/window, legacy internal identity, packaged SVG and both themes passed with no page errors. Its version was supplied from packaged metadata because the host executable was development Electron; this was not a personal installed-app test.
- SHA-256 verification passed for the DMG, ZIP and legacy DMG alias.

## Deliverables

- `outputs/Gom-macOS-arm64-0.6.0.dmg`
- `outputs/Gom-macOS-arm64-0.6.0.zip`
- `outputs/TinNhan-macOS-arm64-0.6.0.dmg` (compatibility alias)
- `outputs/SHA256SUMS-Gom-0.6.0.txt`
- `out-release/Gom-darwin-arm64/Gom.app`
- Evidence and light/dark screenshots: `outputs/Gom-0.6.0/`.

DMG SHA-256: `b857cce18968bd2cb263095caf0a0628a0f0afe697ee54da0ab52aca3f9b58df`.

ZIP SHA-256: `ea92b8de02b8688a3d5f16e7f3e2266736da4cf54431ba8c87c14fb2d9d4d0b3`.

The build remains ad-hoc signed, without Developer ID/notarization; macOS may request Keychain authorization after a rebuild. Actual provider-session expiry and draft restoration after quitting still depend on the providers. No personal app installation or live-account test was performed. The build was subsequently published as recorded below.

## Public release — 26/10/2026

The user requested publishing all source and the newest installer after Gom completed. Source commit `490b1df760b479ee64b44c91b2e003e162be6e45` and annotated tag `v0.6.0` were pushed to `main`/GitHub. [Gom 0.6.0](https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.6.0) is a stable, non-draft Latest release with the canonical DMG, ZIP, TinNhan compatibility DMG and checksum file.

Fresh pre-push typecheck/build and all 128 unit tests passed. Every runtime file from the fresh source build matches the packaged ASAR. GitHub asset sizes and SHA-256 digests match the local verified artifacts; the public canonical DMG returns HTTP 200. Unauthenticated update checks against the live release return `current` for Gom 0.6.0 and `available` for the original packaged Tin Nhan 0.5.4 checker. Evidence: `outputs/publish-0.6.0/` (local, ignored).
