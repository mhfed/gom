# Gom Windows Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows x64 installer and in-app updater, preserve Tinder import, add Windows Chrome cookie import parity for the providers already supported on macOS, and prepare a shared Gom 0.7.7 release.

**Architecture:** Use Electron Forge's Squirrel.Windows maker on a manually triggered Windows GitHub Actions runner. Extend the existing release checker and Electron updater to select platform-specific assets and feeds. Use Node's built-in read-only SQLite API for the Windows Chrome cookie database, Windows DPAPI for legacy Chrome key/cookie formats, and the existing Tinder DevTools bridge with a Windows Chrome profile root.

**Tech Stack:** Electron 45, Electron Forge 8.0.1, Squirrel.Windows, Electron `autoUpdater`, update.electronjs.org, Node.js 24, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-windows-distribution-design.md`

## Global Constraints

- Release version: `0.7.7`; publish the macOS arm64 and Windows x64 asset sets under one stable GitHub Release.
- Windows installer: Squirrel.Windows per-user `Setup.exe`; Windows architecture: `x64` only.
- Windows updates: Electron `autoUpdater` through `https://update.electronjs.org/mhfed/gom/win32-x64/<current-version>/RELEASES`.
- Windows release workflow: `workflow_dispatch` only; do not build on PR, push, or tag.
- SHA-256 manifests are per-platform: macOS packages are checksummed on the Mac host; Windows packages are checksummed on the Windows runner.
- Chrome imports on Windows cover the same providers that currently have cookie imports on macOS: Zalo, Messenger, Instagram, and Slack. Gmail, Telegram, and Discord remain direct-login providers because they do not have cookie import support in the existing Mac app.
- Windows Chrome profiles: discover under `%LOCALAPPDATA%\\Google\\Chrome\\User Data`; read Cookies with Node `node:sqlite` in read-only mode; use Windows DPAPI for legacy profile keys/cookie blobs and AES-GCM for legacy `v10` values.
- Chrome App-Bound (`v20`) cookies are unsupported. Detect them, fail closed with direct-login guidance, and do not attempt to bypass Chrome's privileged App-Bound service. Mixed-format profiles can still import if the required cookies for the selected provider decrypt and validate.
- Tinder import: use the existing DevTools bridge and show `Ctrl+Shift+J` on Windows.
- No Authenticode certificate is available; document SmartScreen and Smart App Control limitations.
- Do not run a package build or dispatch the Windows workflow until the user explicitly approves the build.
- Do not add or run automated tests unless the user explicitly asks. Use typechecking and source review for this implementation stage.

## Files and Responsibilities

- `package.json`, `package-lock.json`: version 0.7.7, Windows package scripts, and the Forge Squirrel maker.
- `forge.config.cjs`: platform-specific icons, Squirrel.Windows maker metadata, Windows x64 package naming.
- `scripts/icon.mjs`, `assets/app.ico`: produce and store the Windows icon from the current app artwork.
- `scripts/build.mjs`: enable automatic updates for Squirrel Windows builds without weakening the macOS signing gate.
- `src/main/main.ts`: OS-aware Chrome root, Tinder Console shortcut copy, App-Bound import guidance, Squirrel startup, Windows update feed and lifecycle.
- `src/main/local-accounts.ts`, `src/main/import-crypto.ts`: read-only Windows Chrome SQLite access, legacy DPAPI/AES-GCM cookie decryption, and fail-closed `v20` handling while retaining the existing macOS Keychain path.
- `src/main/windows-dpapi.ts`: current-user DPAPI unprotection through a fixed PowerShell command; no cookie or key bytes in command text or logs.
- `src/main/update-check.ts`: platform- and architecture-aware release compatibility checks.
- `src/renderer/index.html`, `src/renderer/shell.ts`: platform-specific Windows settings labels and shortcut hints while preserving the macOS copy.
- `src/renderer/shell.ts`: existing import notice flow renders the clear unsupported-format guidance; no shared-state shape change is needed.
- `.github/workflows/windows-release.yml`: manually build Windows x64 and upload assets to an existing draft release.
- `README.md`, `docs/distribution.md`, `docs/release-0.7.7.md`: current version, installation, update and unsigned-app guidance.

## Review Focus

- A missing or nonstandard Windows Chrome installation must show the existing no-profile state without crashing.
- Chrome profile IDs such as `Default` and `Profile 2` must remain separate and pass unchanged to Tinder import.
- Tinder import guidance must use the Windows DevTools shortcut while the macOS shortcut stays unchanged.
- Windows cookie imports for Zalo, Messenger, Instagram, and Slack must never invoke `/usr/bin/sqlite3` or `/usr/bin/security`; database access stays read-only and decryption remains scoped to the current Windows user.
- Windows App-Bound `v20` values must return a clear unsupported-session result without replacing destination cookies; legacy DPAPI and `v10` values still pass provider allowlists, expiry checks, and staged session verification.
- A Windows release missing its Squirrel installer, `.nupkg`, or `RELEASES` metadata must not appear as a compatible automatic update.
- macOS arm64 release matching and its Developer ID/notarization gate must remain unchanged.

---

### Task 1: Add Windows x64 packaging and platform assets

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `forge.config.cjs`
- Modify: `scripts/icon.mjs`
- Create: `assets/app.ico`
- Modify: `scripts/build.mjs`

**Interfaces:**

- Produces `npm run make:win` for a native Windows x64 runner.
- Squirrel maker outputs the versioned Gom setup executable, full `.nupkg`, and `RELEASES` manifest.
- Keeps `npm run make` targeting macOS arm64.

- [ ] Set package version to `0.7.7` and replace the macOS-only description with platform-neutral Gom copy.
- [ ] Add `@electron-forge/maker-squirrel` at the same Forge version as the current CLI/makers; handle Squirrel startup arguments with a small main-process helper so no runtime dependency is needed.
- [ ] Add `make:win` targeting `win32`/`x64` without changing the existing macOS `make` command.
- [ ] Extend `scripts/icon.mjs` to generate a valid multi-size `assets/app.ico` from the existing Gom artwork; retain the current ICNS generation.
- [ ] Select `.ico` for Windows and `.icns` for macOS in `forge.config.cjs`.
- [ ] Configure the Squirrel maker with Gom package ID, authors, description, and a `Setup.exe` name containing `win32-x64` and the package version; keep Squirrel's package filenames referenced by `RELEASES` intact.
- [ ] Change `scripts/build.mjs` so Windows builds enable the compiled updater flag, while macOS still enables it only when Developer ID and notarization values are present.
- [ ] Run `npm run typecheck` and inspect the Forge configuration and generated-icon code. Do not invoke either `make` command.

### Task 2: Support Chrome session import parity on Windows

**Files:**

- Modify: `src/main/local-accounts.ts`
- Modify: `src/main/import-crypto.ts`
- Create: `src/main/windows-dpapi.ts`
- Modify: `src/main/main.ts`

**Interfaces:**

- `ChromeSources` keeps the existing `list()` and `loginCookies(sourceId, provider)` contracts across macOS and Windows.
- Windows SQLite access is read-only and uses the `node:sqlite` runtime bundled with Electron 45 / Node.js 24; no external `sqlite3.exe` is required.
- A Windows-only DPAPI helper unwraps the Chrome legacy master key or old directly encrypted cookie values for the current Windows user. Cookie values beginning `v20` return the explicit `app-bound` failure code.
- Tinder import continues using the existing `importTinderChromeSession(sourceId, targetId)` and `createTinderChromeBridge()` contracts.

- [ ] Choose the Chrome root by platform: `%LOCALAPPDATA%\\Google\\Chrome\\User Data` on Windows and preserve `~/Library/Application Support/Google/Chrome` on macOS; use the standard per-user `AppData/Local/Google/Chrome/User Data` fallback if `LOCALAPPDATA` is absent.
- [ ] Keep profile discovery and provider validation shared; use Node `DatabaseSync` with `readOnly: true` and a bounded busy timeout for Windows cookie DB queries, preserving safe path validation and never mutating the source DB.
- [ ] Read Chrome's Windows `Local State` `os_crypt.encrypted_key`, verify the `DPAPI` prefix, unwrap it through a fixed PowerShell `ProtectedData.Unprotect` script using `CurrentUser`, and clear temporary key buffers. Do not pass cookie values or key data into shell source text or logs.
- [ ] Extend crypto decoding for Windows legacy direct-DPAPI cookie values and AES-256-GCM `v10` values, including the current Chrome host-binding validation when applicable. Retain macOS Keychain/PBKDF2/AES-CBC behavior.
- [ ] Detect `v20` App-Bound values and return an explicit unsupported-session code. Do not invoke or bypass Chrome's App-Bound service; allow a mixed-format profile only when all required cookies for the selected provider can be imported and verified.
- [ ] Keep the per-provider cookie allowlists and support Windows cookie import for Zalo, Messenger, Instagram, and Slack; preserve direct login for providers without an existing cookie-import flow.
- [ ] Keep Tinder's loopback DevTools bridge unchanged apart from selecting the Windows Chrome root and showing `Ctrl+Shift+J`; preserve `⌥⌘J` on macOS.
- [ ] Show a direct-login explanation for unsupported App-Bound/legacy cookie formats, and ensure destination cookies remain untouched when decryption or staged verification fails.
- [ ] Run `npm run typecheck` and inspect the platform branches for Mac/Windows behavior; do not run tests.

### Task 3: Add Windows release detection and automatic updating

**Files:**

- Modify: `src/main/update-check.ts`
- Modify: `src/main/main.ts`
- Modify: `src/update-types.ts`

**Interfaces:**

- `ManualUpdateChecker` receives the current platform and architecture in addition to version and callback.
- Windows x64 update feed uses `https://update.electronjs.org/mhfed/gom/win32-x64/<current-version>/RELEASES`.
- macOS arm64 feed retains `https://update.electronjs.org/mhfed/gom/darwin-arm64/<current-version>`.

- [ ] Make the checker match macOS assets as it does today and Windows x64 Squirrel setup assets using versioned `win32-x64` names.
- [ ] Mark Windows as compatible only when the stable release includes its setup executable and the required Squirrel `.nupkg` and `RELEASES` metadata.
- [ ] Initialize `ManualUpdateChecker` with `process.platform` and `process.arch`; preserve the fixed-repository HTTPS URL validation.
- [ ] Handle Squirrel install/update/uninstall arguments before normal app startup and set the Squirrel App User Model ID.
- [ ] Enable packaged Windows `autoUpdater` handling, set the Windows Squirrel feed without the macOS JSON server mode, and keep the current signed-macOS path unchanged.
- [ ] Delay the first Windows updater check after Squirrel's first-run file-lock period; use the existing in-app downloading state and downloaded/install-on-restart/error states. The built-in updater does not expose a numeric Windows download-progress event.
- [ ] Use Windows labels, shortcuts, and notification settings in the existing preferences UI; keep macOS wording and settings links on macOS.
- [ ] Run `npm run typecheck` and `git diff --check`; do not run tests or package builds.

### Task 4: Prepare manual Windows release workflow and 0.7.7 docs

**Files:**

- Create: `.github/workflows/windows-release.yml`
- Modify: `README.md`
- Modify: `docs/distribution.md`
- Create: `docs/release-0.7.7.md`

**Interfaces:**

- Workflow input: an existing `v0.7.7` draft release tag.
- Workflow permissions: `contents: write`; workflow trigger: `workflow_dispatch` only.
- Assets uploaded by workflow: Squirrel `Setup.exe`, full `.nupkg`, and `RELEASES`; publish remains a separate user-authorized action.

- [ ] Add a manual Windows runner workflow that checks out the supplied tag, uses Node.js 24, runs `npm ci` and typecheck, invokes `npm run make:win`, and uploads the three Squirrel assets to the existing draft release.
- [ ] Generate `SHA256SUMS-Gom-0.7.7-windows.txt` for the Windows `Setup.exe` and full `.nupkg`; the Mac host keeps its own manifest for the DMG/ZIP. Do not upload or publish a release from the workflow unless the user has explicitly approved that build.
- [ ] Update current README and distribution instructions to describe 0.7.7 as macOS arm64 plus Windows x64, including Squirrel auto-update behavior, Windows Tinder import, legacy DPAPI cookie import, the App-Bound `v20` limitation, and unsigned-install warnings.
- [ ] Add `docs/release-0.7.7.md` with the new context, installer, update, and signing limitations.
- [ ] Run `npm run typecheck` and `git diff --check`. Do not build, dispatch the workflow, create the tag, or publish the release before explicit user approval.

## Completion Checks

- Source typecheck passes and `git diff --check` is clean.
- The Windows workflow exists with only a manual trigger and requires an existing draft release tag.
- No Windows or macOS package build has run without separate user approval.
- After the user approves a build, run the Mac release flow and manually dispatch the Windows workflow; verify both asset sets and checksums before asking to publish the stable release.
