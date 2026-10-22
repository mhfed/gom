# Tin Nhan macOS implementation

Date: 2026-10-22. Approved personal app, Apple Silicon, Electron 45. Source is isolated in this projectless non-Git directory. Planning and session-source probes are recorded in ../../outputs/desktop-plan.md and macos-session-check.md.

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

User requested Git initialization and upload. Source repository root is this desktop-app directory; branch main, destination private GitHub repository mhfed/tin-nhan-desktop. Only source, tests, build configuration, development scripts and brand/icon assets are tracked. Built apps, ZIPs, dependencies, caches, environment files and all external account/session data are excluded. Preflight source scan: 48 files, no credential-pattern findings; npm run typecheck PASS; npm test20/20 PASS. Publication verification will compare local HEAD with remote main. Phase rework0; actual token usage unavailable.
