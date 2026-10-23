# Tin Nhan macOS implementation

Date: 2026-10-22. Approved personal app, Apple Silicon, Electron 45. Source is isolated in this projectless directory and now tracked in its own Git repository. Planning and session-source probes are recorded in ../../outputs/desktop-plan.md and macos-session-check.md.

## Goal and status

Implemented and packaged Tin Nhan 0.1.0. All three official service UIs authenticated in the packaged app. Final three-cycle live persistence checks PASS on the exact signed app copied into outputs; source and result archives are delivered alongside it.

## Contract and decisions

- Three lazy WebContentsViews; fixed persist:zalo, persist:messenger, persist:telegram. Switching does not reload or replace a view.
- Local sandboxed shell alone has privileged preload. IPC validates sender/main frame and provider. Remote views have sandbox/context isolation, no Node or privileged preload. Exact HTTPS provider hosts; no wildcard, certificate bypass or security disabling.
- Zalo QR login uses id.zalo.me → jr.zaloapp.com → jr.chat.zalo.me → chat.zalo.me, observed live with successful scan and confirmation codes. Missing middle hosts caused a QR loop and are now allowed only for Zalo.
- Messenger reads only selected Chrome c_user/xs, source SQLite read-only, ordinary Chrome Safe Storage Keychain access. Stage authentication, staged final pair, destination authentication inside rollback boundary. Import operation gate coordinates quit. No source writes or credential logs.
- Zalo/Telegram QR; no native-session import claim. Preserve native cookie expiry; no extended auth vault. Stable userData: ~/Library/Application Support/TinNhanDesktop.
- Window close/Cmd+Q waits for import, flushes session storage/cookies, destroys views and exits. No session clear. macOS arm64 package signed ad-hoc; no Developer ID/notarization.

## Changed paths

src/shared.ts; src/main/{main,preload,security,local-accounts,import-crypto,cookie-transaction,operation-gate,view-registry,auth-detection}.ts; src/renderer/{index.html,shell.ts,shell.css}; tests/{core,accounts,auth}.test.ts; scripts/{build,icon,persistence-check,live-check}.mjs; scripts/persistence-entry.ts; assets; package.json; package-lock.json; tsconfig.json; forge.config.cjs; README.md; .gitignore.

## Verification

- npm run typecheck — PASS.
- npm test — PASS 14/14; core implementations and regression fixes each had observed RED before GREEN.
- npm run test:persistence — PASS, real Electron two-process fixture: three independent partitions, cookie/localStorage/IndexedDB survive, views reused and drafts retained during switches.
- npm run make — PASS, final build under out-release, ZIP maker.
- codesign --verify --deep --strict '../../outputs/Tin Nhan.app' — PASS; signature ad-hoc, arm64, bundle local.mhfed.tinnhan.desktop.
- ASAR inspection — PASS: no src/tests/scripts developer harness shipped; final Zalo redirect hosts present.
- node scripts/live-check.mjs with TIN_NHAN_APP pointing to outputs bundle — PASS three successive post-reopen checks, each returned authenticated for all three providers without reimport or QR. Original Messenger imported from approved Default and survived earlier repeated full app exits. Telegram QR account also survived earlier repeated exits.
- ps -axo pid,comm with app-only filter after full quit — PASS, no app/helper process remained.
- Visual: settings 1024x720 and large requested 1440x900 (macOS clamps actual content to 1440x882 on this display); no shell clipping. Native QR states inspected; authenticated platform controls verified using coarse booleans, no saved chat screenshots in deliverables.
- Independent bounded read-only review — two import lifecycle findings fixed and rechecked; exact Zalo redirect-host delta reviewed, no remaining blocker.

## Risks and next gate

Three live cycles completed; source ZIP and SHA256 checksum file created in outputs. Keep test helpers out of production ASAR and do not include userData in any archive. Real sending, calls, notification permission, file transfer and 30-minute resource soak are not verified; no success claims for them. One point-in-time process sample was ~1.42 GiB summed RSS, not a soak result. Platform expiry/revocation can require re-login.

## Measurement

Corrective rework this implementation phase: 9 cycles — iconutil/ICNS, fixture executable resolution, review lifecycle/rollback correction, optional Cookie typing correction, Telegram QR status mismatch, unavailable TypeScript7 formatting API, inherited signature correction, Zalo login redirect allowlist omission, Zalo authenticated status precedence. Planned RED tests excluded. Network sandbox retries are environment notes, not product cycles. Actual token usage: unavailable.

## Clubhouse theme update

Goal: quick visual refresh of the existing shell in classic Clubhouse style. Warm cream, rounded white cards, pastel service marks, green pill buttons, wave brand mark. The 208px sidebar and 76px header contract remains fixed for native views. Changed only src/renderer/shell.css and index.html. No authentication/session code changes.

Verification: npm run typecheck PASS; npm test PASS14/14; npm run make PASS; codesign --verify --deep --strict on output app PASS. Packaged smoke PASS: all three providers authenticated with saved sessions. Settings screenshots inspected at1024x720 and1440x882, no clipping. Source/archive refreshed. No new unit tests for the reversible styling change. Phase rework0; actual token usage unavailable.

## Version 0.2.0 logos sidebar and unread badges

Goal: authentic platform logos, collapsible sidebar and live unread indicators. Contract: 208px expanded / 80px collapsed sidebar with native view bounds synchronized; toggle does not reload or replace a view; boolean saved on quit. Three service views start hidden/inactive as needed so badges can update without visiting each platform. Count collector returns only numeric indicators, not message/account text. Platform totals take priority; loaded-row lower bounds show +; absent reliable source shows —. Zalo zero only for the verified exact empty message-nav structure; unsupported glyphs stay unknown. Telegram uses exact Unread label after removing badge content. Messenger uses scoped title / explicit unread indicators, never generic Facebook notifications.

Paths: src/shared.ts; src/main/{layout,unread,unread-snapshot,main,preload}.ts; src/renderer/{index.html,shell.ts,shell.css,logos/*}; scripts/build.mjs and live-check.mjs; tests/sidebar.test.ts; package*.json version0.2.0. Brand provenance in src/renderer/logos/SOURCES.md. Linkedom is dev-only for DOM fixtures.

Verification: core regression tests observed RED then GREEN; typecheck PASS; npm test20/20 PASS; make PASS; output codesign verify PASS. Independent bounded review corrected Telegram similar-folder match and unsupported Zalo badge fallback, recheck no blocker. Live/visual gates PASS: collapse80/expand208, native bounds match, view ids retained; collapsed boolean survives full quit/relaunch; authenticated all3 after reopen. Expanded/collapsed1024x720 screenshots inspected. Hidden view viewport fixed; hidden startup warm-up followed by normal throttling after authentication. Final packaged smoke PASS: all3 authenticated, all3 backgroundThrottling restored true, countersTelegram20/Zalo0/Messengerunknown; logo assets present and harness absent in ASAR. Page Visibility returned visible for all hosted views in this snapshot; native view hiding does not establish page-hidden state, so no read-receipt behavior claim.

Limit: current Messenger web UI exposes no reliable overall count; shows — until a supported counter/row indicator is available, not an invented0. Telegram live counter20 and known empty Zalo message badge0 observed before packaging. Rework this feature phase4 (review accuracy corrections, hidden viewport correction, hidden client startup throttling correction, restore-default-throttling review mitigation). Actual token usage unavailable.

## GitHub publication 2026-10-22

User requested Git initialization and upload. Source repository root is this desktop-app directory; branch main, destination private GitHub repository mhfed/tin-nhan-desktop. Only source, tests, build configuration, development scripts and brand/icon assets are tracked. Built apps, ZIPs, dependencies, caches, environment files and all external account/session data are excluded. Preflight source scan: 48 files, no credential-pattern findings; npm run typecheck PASS; npm test20/20 PASS. Publication PASS: initial snapshot71876c6 pushed to https://github.com/mhfed/tin-nhan-desktop; repo privacy and main default branch verified through gh repo view; git ls-remote matched local HEAD. Final documentation commit is pushed on the same branch and its remote hash checked at delivery. Phase rework0; actual token usage unavailable.

## Release 0.2.0 publication 2026-10-22

Goal/status: published v0.2.0 with TinNhan-macOS-arm64-0.2.0.zip (118598197 bytes); README adds direct download, release notes link and installation/access requirements. Release targets b070d026f2590d6abcfc78f677ecc1654e3210cc. No runtime changes or account data included.

Changed paths: README.md, HANDOFF.md. Verification: gh release create v0.2.0 with ZIP and notes file PASS; gh api repos/mhfed/tin-nhan-desktop/releases/tags/v0.2.0 PASS (draft=false, expected asset URL, SHA-256 d5adabcac142e21724e73db4e88d3205955ee975062f4bd0854700a3d843128b matches original archive). git diff --check required before commit; remote README link and HEAD checked after push. Runtime tests not rerun for documentation/release-only work; prior 20/20 result unchanged.

Limits: repository private; download requires authorized GitHub account. App arm64 and ad-hoc signed, not notarized. Next gate: documentation commit pushed and remote contents verified. Rework0; actual token usage unavailable.

## macOS window lifecycle 0.2.1

Goal/status: Cmd+W/window close hides the main window without destroying service views; Dock activation restores the same window; Cmd+Q retains the existing import wait, save, session flush and exit sequence. Explicit Close menu role provides the native shortcut. Background polling remains active while hidden. README also reflects public repository access.

Changed: src/main/main.ts, scripts/window-lifecycle-check.mjs, package.json, package-lock.json, README.md, HANDOFF.md. Verification: npm run build PASS; npm run typecheck PASS; npm test PASS20/20; node scripts/window-lifecycle-check.mjs observed RED for close quitting, then PASS for hide, activation retaining window/view ids, and app.quit exiting. Integration fixture sets appData in a test-only bootstrap before loading production code; no personal session used. Initial harness launch hit the running app lock because production fixes userData; corrected fixture isolation. Native menu/key behavior wired via Electron close role; physical keyboard/Dock click not manually tested. npm run make retried with network permission after sandbox fetch failed. Output signature and archive checks recorded at delivery.

Rework1 (fixture appData isolation); actual token usage unavailable. No new public Release uploaded in this phase; 0.2.0 asset remains the prior version. Next gate: packaged ZIP/signature verification and source push.

Packaging gate: npm run make PASS; codesign --verify --deep --strict 'out-release/Tin Nhan-darwin-arm64/Tin Nhan.app' PASS; unzip -tq outputs/TinNhan-macOS-arm64-0.2.1.zip PASS. Delivered local ZIP0.2.1; source committed/pushed to main. Existing README download remains the published0.2.0 asset, explicitly versioned.

## Active platform shell colors 0.2.2

Goal/status: sidebar and header follow the active platform's computed neutral navigation background. Derive validated hex-only surface, border, readable text and muted colors; preserve original logos and dimensions. Cache per provider in memory; refresh on load, selection and existing4s poll. Missing sample uses macOS prefers-color-scheme fallback; no DOM text, credentials or message content returned. Sample a small fixed left-side grid, walk transparent/colorful ancestors, choose repeated neutral opaque background. Settings shares the active palette.

Changed paths: src/main/theme.ts, src/main/main.ts, src/shared.ts, src/renderer/shell.ts, src/renderer/shell.css, tests/theme.test.ts, scripts/theme-check.mjs, package*.json, README.md, HANDOFF.md.

Verification: node --test --experimental-strip-types tests/theme.test.ts initially failed for missing module, then PASS2/2; npm run typecheck PASS; npm test PASS22/22; npm run build PASS; node scripts/theme-check.mjs PASS (isolated appData and intercepted fixture pages for all3 platforms, expected exact colors, same sidebar/header backgrounds, runtime dark-to-light change, collapsed screenshot); node scripts/window-lifecycle-check.mjs PASS (hide/restore retained view ids, quit exits). Inspected light, dark and collapsed fixture screenshots; allowed140ms button transitions to settle before final screenshots. npm run make PASS; codesign --verify --deep --strict on output app PASS. ZIP integrity and hash checked at delivery.

Risks: real signed-in provider theme layouts not exercised this phase; platform DOM/custom backgrounds may require sampling adjustments. No claim that settings/canvas-only custom themes always expose a suitable sampled surface. Electron page screenshot captures shell, not a composite of native hosted views. Existing public release still0.2.0; local ZIP0.2.2 includes Cmd+W fix. Next action: user try0.2.2 with current platform themes; investigate any reported mismatch before release update. Rework0; actual token usage unavailable.

## Desktop 0.3.0 — 2026-10-23

Goal/status: implementation and automated/package gates complete for stability, macOS controls and native platform notifications. Source version0.3.0; output ZIP and signed app in outputs/TinNhan-0.3.0. User confirmed the real macOS test notification banner appeared and clicking it opened Telegram correctly. No new GitHub Release published.

Contract/decisions: bounded1/3/10s minimum recovery waits (existing4s tick, max3 automatic retries), only failed main provider pages; no healthy-page reload on wake/network return. Crash handler, offline vs login states, stale-detection epoch + single-flight guard, late failed-load finish protected. Block offsite redirects without attributing popup/subframe failure to principal. Sessions/partitions unchanged. Cmd+W hides, Cmd+Q waits import/flushes/exits; native menu bar, optional fixed Cmd+Shift+Space shortcut with conflict handling, packaged-only OS login-item control default off, validated saved window bounds and serialized atomic preference writes. Main module no longer hardcodes personal email. Dock uses unread presence bullet rather than mixed-unit sum.

Notification decision: retain actual platform-created native notifications; ask/allow/mute per provider and global pause enforced by owned-main-frame/origin permission handlers. Sandboxed platform-preload exposes one no-argument notification-click capability and wraps original window.Notification with a click listener; IPC validates owned view/popup main frame and allowed origin, maps provider internally, rate-limits focus and returns no message data. No synthetic unread-based alerts, no duplicate native alert. Native test alert/status and macOS notification-settings link added. Service worker/cold-start click routing and actual incoming platform notifications remain live verification limits; muting does not silence page audio/calls or remove already delivered alerts.

Changed paths: src/main/{main,preload,platform-preload,notification-click,notification-policy,preferences,recovery}.ts; src/shared.ts; src/renderer/{index.html,shell.ts,shell.css}; scripts/{build,desktop-check}.mjs; tests/{desktop,notification-click}.test.ts; package*.json; README.md; docs/superpowers/plans/2026-10-23-desktop-0.3.md; HANDOFF.md.

Verification:
- npm run typecheck — PASS final.
- npm test — PASS30/30 final; regression tests for recovery limits, malformed prefs/bounds, serialized writes, permission scope, unread presence and native notification wrapper.
- npm run build; node scripts/desktop-check.mjs — PASS final, isolated OS/home/appData fixtures; real renderer permission query allow/pause, mainframe/offsite denial, notification-click route and mock OS test delivery, shortcut/conflict mock, offline/wake preserves other draft, late finish stays failed, actual forcefullyCrashRenderer recovers principal only, window/view identity and persisted settings after restart. No login item changes or messages sent. Initial tests and review regression observed failing before fixes.
- node scripts/window-lifecycle-check.mjs — PASS on final code, hide/activate retaining ids, quit exits.
- npm run test:persistence — PASS final, two-process cookie/localStorage/IndexedDB persistence and partition/view isolation for all3.
- node scripts/theme-check.mjs — PASS with0.3 shell before redirect-only correction. Representative dark settings and notifications-section fixture screenshots inspected; fixture home isolated so no personal profile metadata in final test screenshots. No small-window visual gate claimed.
- npm run make — PASS final after redirect correction.
- codesign --verify --deep --strict on out-release app and copied outputs/TinNhan-0.3.0/Tin Nhan.app — PASS.
- unzip -tq outputs/TinNhan-macOS-arm64-0.3.0.zip — PASS; SHA256 ea644ea573afdbcf67db23fe5322559bc6c3728ce936756cf7e81c20f4701ab9. Version0.3.0 verified in package ASAR and Info.plist; ASAR37 paths, no source/tests/scripts/node_modules or account storage, expected notification-only preload/tray asset present.
- Packaged live check via scripts/live-check.mjs using signed0.3 app: check/quit/launch/check/quit — PASS all3 authenticated twice, no reimport/QR or message sends. Original interactive invocation stdin closed; app gracefully quit with native Cmd+Q before controlled pipeline check. Current app opened from outputs with tty harness and left at Settings for user banner check.
- One independent bounded read-only reviewer found blocked iframe/popup redirect incorrectly failed healthy principal; dedicated Electron regression observed RED then GREEN, reviewer recheck confirmed correction and no remaining blocker.

Measurement: corrective rework4 — strip-only test syntax, late finish state correction, async Playwright wait replaced by host-side awaited polling after flaky false readiness, review redirect-attribution correction. Planned feature RED tests excluded. Actual token usage unavailable. Risks: incoming-message notifications per platform and physical startup-login action remain unverified; native workers/cold clicks not guaranteed; no soak/battery/call/file-send success claims. Delivery: implementation commit14d3395 pushed to main and remote hash verified; local signed ZIP delivered. User confirmed real test banner/click PASS on packaged0.3.0. Next gate: actual incoming-message notification checks per platform if requested; preserve published0.2.0 release until release update is requested.

User verification follow-up: native test banner + click to Telegram PASS, reported directly by user. This validates app-to-macOS delivery and live click routing for the test alert; does not establish incoming Telegram/Zalo/Messenger message notifications. Documentation-only update; git diff --check PASS, runtime tests not rerun; rework unchanged4, actual token usage unavailable.
