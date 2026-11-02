# Gom for Windows — distribution and updates

## Intent

Provide a Windows x64 edition with a normal installer and in-app automatic updates, distributed from the existing public GitHub Releases page. The next release is 0.7.7 so Windows support does not reuse the already published 0.7.6 number.

## Goals

- Install Gom on Windows x64 without requiring administrator access.
- Detect releases, download updates in the app, and install after the user chooses to restart.
- Import the user's existing Tinder session from a Chrome profile using the current one-time DevTools flow.
- Import the Chrome cookie sessions already supported on macOS: Zalo, Messenger, Instagram, and Slack.
- Publish Windows and macOS arm64 assets under the same 0.7.7 GitHub Release.
- Keep the existing local account and application data model on each machine.
- Build Windows packages only from a Windows CI runner, with the workflow invoked manually after the user approves a build.

## Non-goals for the first Windows release

- Windows ARM64 and 32-bit Windows.
- Microsoft Store/MSIX distribution.
- Decrypting Chrome App-Bound cookies (`v20`) on Windows. Gom will import legacy DPAPI-protected values and non-App-Bound `v10` cookies, then fail closed with direct-login guidance when a required cookie is App-Bound.
- Authenticode certificate procurement. Unsigned downloads may show Windows SmartScreen warnings, and some Smart App Control policies may block unsigned apps. This tradeoff must be shown in release instructions.

## Approaches

1. **Squirrel.Windows with Electron `autoUpdater` and `update.electronjs.org` — recommended.** Electron Forge creates `Setup.exe`, a full `.nupkg`, and `RELEASES`. Electron's built-in updater consumes the Squirrel feed from the public GitHub release. This directly meets the installer and self-update request and avoids a new update server. The Squirrel maker must run on Windows, so add a manually triggered Windows x64 GitHub Actions workflow. Upload the setup executable, package, and `RELEASES` manifest with names that the update service recognizes.
2. **MSIX/App Installer.** Offers Windows-native package management and updates, but requires a trusted package-signing certificate and a different installation/distribution path. It adds a signing prerequisite without helping the existing GitHub Release workflow.
3. **Traditional standalone installer with a custom updater.** Can make an installer, but Electron's Windows updater does not manage ordinary installer packages. A custom download, replacement, restart, and rollback system would add work and risk while duplicating Electron's Squirrel support.

The user requested both installation and in-app automatic updates. Squirrel.Windows is the recommended implementation because it is the direct fit for a public GitHub Release and Electron's built-in Windows updater. The project currently has no Windows maker or CI workflow and hard-codes packaging to macOS arm64.

## Design

### Packaging and release

- Add Electron Forge's Squirrel.Windows maker and its required package metadata. Configure a Gom Windows x64 package ID and a user-facing `Gom Setup.exe` installer.
- Create a Windows icon from the existing app artwork and select it only for Windows; keep the existing ICNS for macOS.
- Add separate macOS and Windows packaging scripts. Preserve the macOS arm64 build. Build the Windows x64 Squirrel package on `windows-latest`.
- Add a `workflow_dispatch`-only Windows release workflow. It builds the checked-out tagged source and uploads the Windows `Setup.exe`, `.nupkg`, and `RELEASES` file to the already-created GitHub Release. Do not trigger a build automatically on PR, push, or tag.
- Preserve the current macOS release step: the Mac host builds and uploads the arm64 DMG/ZIP to a draft tag. The manually started Windows workflow then adds the Squirrel assets to that same draft. Publish only after both platform asset sets and checksums are present.
- Bump the app to 0.7.7, update release documentation, and include both existing macOS distribution formats and the Windows Squirrel assets in the 0.7.7 release. Keep a separate SHA-256 manifest beside each platform's user-facing installers and update package.

### Update behavior

- Extend release compatibility checks to select assets for the running OS and architecture. Windows x64 is available only when the release has the correctly named Squirrel setup asset and the Squirrel update metadata required by Electron's update service.
- Enable Electron `autoUpdater` on packaged Windows builds as well as the existing eligible macOS builds. Use the `win32-x64` update feed for Windows and retain the current `darwin-arm64` feed for Mac.
- Change the build-time automatic-update flag so Windows Squirrel builds enable Electron updates without Apple signing credentials; keep the existing Developer ID and notarization gate for macOS auto-updates.
- Preserve the existing settings page and update phases. When the user chooses **Tải bản mới**, Electron downloads the Squirrel update and shows the in-app download state; it restarts only after the user confirms installation.
- Handle Squirrel install/update/uninstall startup arguments early, before normal app startup, to prevent duplicate windows and allow shortcut lifecycle handling.
- Skip automatic update checks during Squirrel's first-run file-lock window, then resume normal scheduled checks.

### Windows app behavior

- Keep the existing native Windows window frame; apply macOS-only title-bar, traffic-light, Dock, and input workarounds only on macOS.
- Preserve the app's existing `CommandOrControl` shortcuts and tray behaviors where Windows supports them.
- Discover Chrome profiles under `%LOCALAPPDATA%\\Google\\Chrome\\User Data` (falling back to the standard per-user path when the variable is missing). Read the cookie database in read-only mode with Node's bundled `node:sqlite`, so Windows does not need an installed `sqlite3.exe`.
- Import the supported Windows cookie sessions for Zalo, Messenger, Instagram, and Slack. Unwrap Chrome's legacy user-bound master key with Windows DPAPI, decrypt legacy DPAPI cookie blobs and AES-GCM `v10` cookie values, and preserve the current provider-specific cookie allowlists, expiry checks, staged verification, and rollback behavior.
- Treat App-Bound `v20` cookie values as unsupported. Do not attempt to call or bypass Chrome's privileged App-Bound service. Show an explicit message that the session must be signed in directly in Gom. Profiles containing a mix of formats may still import if all required provider cookies are supported and validate.
- Support Tinder session import through the current one-time DevTools bridge and show `Ctrl+Shift+J` in Windows instructions. The bridge reads Tinder's token, device UUID, and MFA record from the authenticated page and sends them only to Gom's loopback server; it remains independent from cookie decryption.
- Use Electron's Windows safe-storage backend for any encrypted app data; do not add plaintext fallback or migrate encrypted macOS data across operating systems.

## Verification and release gate

- Run type checking and existing non-build verification that is applicable to the changed source. Do not run the Windows package or build workflow until the user explicitly approves the build.
- Do not publish test releases to `mhfed/gom`; the public update service consumes that production channel. After build approval, smoke-test Squirrel update discovery/download/restart from a temporary local feed on the Windows runner using disposable test packages, then remove the fixture.
- After approval, run the Windows workflow manually, verify the installer launches on Windows, validate release asset names and SHA-256 checksums, and only then publish the stable release.
- The Mac and Windows builds need an end-to-end release test because the update service chooses artifacts by platform and architecture.

## User decisions and implementation calls

- The user requested both a Windows installer and in-app automatic updates, approved Squirrel.Windows with a manually started Windows runner, and requested Tinder Chrome session import in the first Windows release.
- The user requested Windows Chrome session import to match macOS. Support the existing cookie-import providers (Zalo, Messenger, Instagram, and Slack) through read-only SQLite plus legacy DPAPI/AES-GCM decryption; Tinder continues to use the DevTools bridge. Gmail, Telegram, and Discord have no Chrome cookie import path in the current macOS app.
- The user accepted that Chrome App-Bound (`v20`) cookies cannot be imported, so Gom must fail closed and direct the user to sign in within Gom.
- Test updates use an isolated temporary local Squirrel feed, never public test releases in `mhfed/gom`.
- The existing macOS host flow adds Mac assets and its checksum manifest to the 0.7.7 draft; the Windows workflow adds Windows assets and its checksum manifest to that same draft. Publish only after both sets are present and verified.
