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

## Desktop 0.4.0 — multi-account — 2026-10-23

Goal/status: implemented multi-account for all three providers; signed local app/ZIP complete. Existing three actual logins authenticated on packaged upgrade and again after full quit/relaunch without QR, reimport or messages sent. Public Release remains0.2.0; no release upload requested this phase.

Contract: unchanged userData/bundle ID and exact legacy persist:zalo/messenger/telegram partitions. New immutable UUID account IDs map to separate partitions; no auth copy on account creation. Versioned atomic metadata catalog/backup, damaged catalog read-only, metadata-only window.json.pre-0.4 backup. Rename/local emoji/order never change identity. Archive retains storage; restore reuses partition; refuse final enabled account archive. Per-account unread/theme/recovery/notifications/permissions and exact click destination; Cmd1/2/3 selects last account within provider. All enabled accounts warm on launch (RAM grows). Explicit captured Messenger target; live main-frame auth/epoch and conservative cookie checks before source access and after staging; final transaction refuses existing login cookies before any write. Stale cookies can require direct login/new account instead of import. Quit awaits account/import operations and persistence.

Changed paths: src/main/accounts.ts; src/main/{main,preload,preferences,recovery,view-registry,notification-policy,cookie-transaction}.ts; src/shared.ts; src/renderer/{index.html,shell.ts,shell.css}; tests/{accounts-multi,accounts}.test.ts; scripts/multi-account-check.mjs; package*.json; README.md; docs/superpowers/plans/2026-10-23-desktop-0.4.md; HANDOFF.md.

Verification:
- npm run typecheck — PASS final; npm test — PASS39/39; npm run build — PASS final.
- node scripts/multi-account-check.mjs — PASS final: isolated fake home/Chrome/Keychain/native notifications; legacy cookie/localStorage/IndexedDB migration, six distinct accounts, safe labels/order/no view recreation, captured import target during switching, initially-undetected existing pair protected, actual staged request observed before injecting new target pair (post-stage refusal/no replacement), unread/permission/click separation, archive/restore, full relaunch identity/preferences/data. No real second-account authentication claimed.
- node scripts/desktop-check.mjs — PASS after import protection; permission/frame ownership, native test/click mock, keyboard/conflict, hide/show, offline/wake/draft, crash recovery, preference persistence.
- node scripts/window-lifecycle-check.mjs — PASS; npm run test:persistence — PASS both processes/all3; node scripts/theme-check.mjs — PASS light/dark/collapsed. Representative multi-account1024x720 light/dark/collapsed fixture screenshots inspected (native hosted views are not composited by shell screenshot).
- One bounded read-only reviewer found import auth race; regression/guard fixed, recheck found no blocker and requested exact staging marker, now added and PASS. Unit no-write guard observed RED then GREEN. Catalog missing-primary/corrupt-backup and per-account click throttle regressions also observed failing then fixed.
- npm run make — PASS final; codesign --verify --deep --strict on packaged and copied output app — PASS; unzip -tq on outputs/TinNhan-macOS-arm64-0.4.0.zip — PASS. Info.plist/ASAR version0.4.0; ASAR38 paths, no source/tests/scripts/node_modules/Partitions. shasum -a256 -c SHA256SUMS-0.4.0.txt in outputs — PASS.
- Actual signed packaged live check: printf 'check\nquit\nlaunch\ncheck\nquit\n' | node scripts/live-check.mjs — PASS all3 authenticated twice. Old0.3 baseline also all3 authenticated, gracefully quit first. No logged-in data exported or cleared.

Measurement: rework9 corrective cycles: Electron fixture evaluation context; legacy cookie persistence expiry; source fixture expiry; global click throttle changed to per-account; corrupt-backup read-only fallback; review import guard; staging-marker regression precision; ASAR verification command syntax; checksum command working directory. Sandbox GUI launch retried with permission, no product change. Actual token usage unavailable.

Risks/next gate: simultaneous two real accounts per provider still requires owner's distinct account QR/explicit Chrome source. Six-account isolation is fixture-verified. Actual incoming platform alerts, worker/cold-start click routing, calls/files and long-duration resource use remain unverified. Local avatar is initials/emoji. Next: user add distinct secondary accounts via + and verify platform behavior; no automatic duplicate-primary login. Source commit/push follows final diff gate; no public release update.

## Sidebar sizing 0.4.1 — 2026-10-23

Goal/status: compact multi-account navigation, consistent shell/native bounds. Expanded224px (was208), collapsed72px (was80), account rows44px with30px avatars; reduced brand/group/footer spacing. Footer/brand fixed, account list alone scrolls. Long labels flex/ellipsis without squeezing avatar/badge. Six accounts fit at720px tall; minimum640px may scroll. No account/session behavior changes.

Changed: src/renderer/shell.css, src/main/layout.ts, tests/sidebar.test.ts, scripts/sidebar-layout-check.mjs, package*.json, README.md, HANDOFF.md.

Verification: npm run typecheck PASS; npm test PASS39/39; npm run build PASS; node scripts/sidebar-layout-check.mjs PASS (isolated fake home, six accounts, long aliases,940x640/1024x720/1280x840 expanded+collapsed, contained rows/avatars/footer, six fit at720, native view bounds match CSS); representative light and dark screenshots inspected at1024x720, plus minimum-size expanded. node scripts/window-lifecycle-check.mjs PASS. npm run make PASS0.4.1; copied output codesign --verify --deep --strict PASS; unzip -tq PASS; Info.plist0.4.1; shasum -a256 -c SHA256SUMS-0.4.1.txt PASS. App opened from outputs/TinNhan-0.4.1.

Rework3: updated stale live harness80/208 assertion to72/224 and added check-legacy so a pending secondary login does not fail the legacy preservation check; initial fixture requested600px but app enforces640px minimum, corrected fixture; version was bumped after first packaging began, rebuilt package to ensure0.4.1. Actual token usage unavailable. No independent reviewer for this small sizing fix. Risk/next gate: arbitrary account counts require scrolling; user feedback on real sidebar proportions. Multi-account/login integration unchanged; previous0.4 coverage remains recorded above. Source commit/push after final diff gate, no Release upload.

Live0.4.1 follow-up: all three legacy statuses authenticated; one user-created secondary account needs-login. Initial all-account check thus correctly false, not session loss. Initial live sidebar-check used stale80/208 constants although measured72px/native72px and preserved view identities; corrected harness. No shipped app change/repackage needed (scripts excluded from ASAR).
Final live harness: check-legacy PASS all3 authenticated; sidebar-check PASS expanded224px/native x224px and unchanged view identity; app left open in Settings. Git implementation ea9bf91 pushed and remote hash matched; harness/doc follow-up committed next.

## Interactive prototype0.5 — 2026-10-24

Goal/status: complete user-approved design preview of chat shell, CmdK account/action switcher and account management. Each supports light/dark and expanded/collapsed (12 combinations). Portable output outputs/TinNhan-0.5-prototype/index.html with embedded assets; local preview on127.0.0.1:8765 requested in Codex browser panel. Production app remains0.4.1 and its sessions were not accessed.

Decisions/contract: warm ivory and graphite-green, compact readable desktop typography; pinned accounts; sidebar224px default, draggable200–300,72 collapsed; shared prototype shell grid. Stateful memory-only fake accounts/messages, per-account draft, search, pins, rename/add, notifications demo, theme preferences, pointer/key resizing. CmdK combobox/listbox focus model and dialog Escape/Tab behavior. Provider content clearly marked illustrative; no unified inbox implementation, no service traffic, credentials or real messages. Existing logo assets reused. Source under scripts/prototype-0.5, excluded from ASAR by existing scripts ignore.

Changed paths: scripts/prototype-0.5/{index.html,style.css,app.js,build.mjs,check.mjs,README.md,assets/*}; docs/superpowers/plans/2026-10-24-prototype-0.5.md; HANDOFF.md. Output HTML plus preview.png and all-12-states.png under outputs/TinNhan-0.5-prototype.

Verification: node scripts/prototype-0.5/build.mjs PASS; node scripts/prototype-0.5/check.mjs PASS final12 variant captures, command filtering/selection/empty/Escape, Tab->ShiftTab->Down->Enter, result-focus Down->Enter, retained focus after account select/pin/notify, draft separation, safe user text, platform filter/add/edit/pin, pointer+keyboard resize, desktop940x640/1280x900/1440x960 and narrow620x800 no horizontal overflow, no JS errors or remote requests. node --check scripts/prototype-0.5/app.js PASS. Inspected contact sheet12 plus representative light chat, dark accounts, dark collapsed command and corrected light chat. Source/package production tests not run because no runtime code changed. git diff --check PASS.

One independent bounded read-only review found command focus/selection divergence and lost focus after rerender; both fixed with smoke coverage and rechecked, no blocker. Rework2: visual readability/sidebar density pass; keyboard focus review correction. Actual token usage unavailable. Risks/next gate: fake provider chat styling is illustrative, production retains native provider content; desktop native hosted-view/modal stacking and real notifications need implementation-specific validation after design approval. Screen reader/manual OS integration not claimed. User visual feedback is next before shipping0.5 production.

## Desktop 0.5.0 — approved prototype implementation — 2026-10-24

Goal/status: production0.5.0 implemented, local signed app/ZIP built; all automated and actual legacy-login restart gates PASS. New app opened at Settings for user delivery. Public Release stays0.2.0; no upload requested this phase.

Contract/decisions: approved ivory/graphite shell with original platform logos, pinned account group, platform filter, categorized account/appearance/notification/macOS settings, icon actions and reversible archive/restore. Sidebar224 default,200–300 resize,72 collapsed; native pane y76 preserved. Explicit light/dark/system or original platform-sampled palette default. Presentation metadata added to existing atomic window.json, validated against known account IDs. Account catalog/partition mapping, userData and bundle ID unchanged; no cookie import/clear/re-login for upgrade. Provider chat stays original web content. CmdK native menu requests shell palette, suppressed while editing account; main hides native views while palette open without unloading; renderer close acknowledgement restores native keyboard focus. Safe DOM text and polling-stable forms/focus.

Changed paths: src/shared.ts; src/main/{presentation,layout,main,preload}.ts; src/renderer/{shell.ts,command.ts,shell.css,index.html}; tests/presentation.test.ts; scripts/{shell-05-check,command-focus-check}.mjs; package*.json; README.md; docs/superpowers/plans/2026-10-24-desktop-0.5.md; HANDOFF.md.

Verification:
- Baseline npm test PASS39/39; final npm run typecheck PASS; npm test PASS42/42; npm run build PASS; git diff --check PASS.
- node --test --experimental-strip-types tests/presentation.test.ts: observed RED (new module absent), then PASS3/3. Legacy defaults, malformed prefs/clamps/pins, dynamic native bounds and hidden overlays.
- node scripts/shell-05-check.mjs: observed initial missing command entry RED; final PASS12 scene/theme/collapse combinations, menu entry from hosted focus, modal visibility, accent-insensitive search/empty/arrows/Enter/Escape, Tab/ShiftTab and result-focus navigation, filter/pin/edit/focus, escaped names, pointer/key resizing,940x640 and1440x900 layout, same native view IDs and unsent fixture drafts, presentation/account IDs survive full restart, no page errors.
- One bounded read-only integration reviewer found2 P2: focus not restored after palette account selection, palette stacking over account editor. scripts/command-focus-check.mjs reproduced both false; after one fix pass both PASS with unsaved editor draft preserved. No further identity/storage or IPC boundary finding. Reviewer did not operate real profiles.
- npm run test:multi-account PASS: old cookie/localStorage/IndexedDB and six separate accounts, protected Messenger target/import race, safe labels/order, unread/notification routing and archive/restore/full restart.
- node scripts/desktop-check.mjs PASS: permission/frame scope, native-notification mock/click, shortcut/conflict, offline/wake/draft, actual fixture renderer crash/recovery and saved prefs.
- node scripts/window-lifecycle-check.mjs PASS: hide/restore same views and quit exits.
- node scripts/theme-check.mjs PASS: three original platform palettes, matching sidebar/header, dynamic theme change and collapse.
- node scripts/sidebar-layout-check.mjs PASS: six44px rows, long labels/footer,940x640/1024x720/1280x840,72/224 native/CSS bounds and six fit at720 without pins.
- npm run test:persistence PASS both processes/all3, cookies/localStorage/IndexedDB/view reuse.
- Visual: inspected fixture accounts-light-expanded, command-dark-collapsed and accounts-940. User chat content never saved in screenshots. Shell captures exclude native provider compositor; provider view bounds/visibility tested separately.
- npm run make PASS0.5.0. codesign --verify --deep --strict on out-release app and outputs/TinNhan-0.5.0/Tin Nhan.app PASS. Info.plist/ASAR version0.5.0,40 paths, no src/scripts/tests/node_modules/Partitions. unzip -tq outputs/TinNhan-macOS-arm64-0.5.0.zip PASS; shasum -a 256 -c SHA256SUMS-0.5.0.txt PASS. SHA25669caae603b21e890f5ab9c0850fc5cec209bd2a0860b696d236f23442204ae96.
- Live baseline0.4.1: printf 'check-legacy\nquit\n' | TIN_NHAN_APP='<outputs0.4.1 executable>' node scripts/live-check.mjs PASS3 authenticated, existing secondary needs-login. Current old harness connection was stale; app gracefully quit via AppleScript and checked with fresh controller.
- Live packaged0.5: printf 'check-legacy\nquit\nlaunch\ncheck-legacy\nquit\n' | TIN_NHAN_APP='<outputs0.5.0 executable>' node scripts/live-check.mjs PASS3 authenticated twice, secondary remains needs-login. No QR/import/message sends. Compared complete accounts.json SHA256 and all4 identity/provider/archive records before/after: identical. Only presentation defaults added to window.json.

Measurement: corrective rework3 total — one product fix pass for two review findings; one verification reconnect for stale old live controller; one artifact listing correction (rg default hid ignored build output, reran --no-ignore). Planned initial RED checks excluded. Actual token usage unavailable.

Risks/next gate: real incoming-message alerts, calls/files and prolonged RAM/battery use not reverified; existing platform/session expiry limitations apply. CmdK registration tested through native menu callback and native focus, physical shortcut keypress not separately claimed. Screenshots cover shell/fixture content, not provider redesign. User visual/use feedback on packaged0.5 is next; public release upload remains separate. Source committed on codex/desktop-0.5, then fast-forward integration/push after final diff gate.

## Release 0.5.0 publication — 2026-10-26

Goal/status: user requested upload; published latest v0.5.0 at https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.5.0, targeting exact build commit f99bdd1cbe4bdab9084290d1191c0b9ebcfef235. Assets: TinNhan-macOS-arm64-0.5.0.zip (118638996 bytes) and SHA256SUMS-0.5.0.txt (96 bytes). README primary download/release links now0.5.0, includes upgrade guidance retaining app data. No runtime or session changes.

Changed paths: README.md, HANDOFF.md. Verification: shasum -a 256 -c SHA256SUMS-0.5.0.txt PASS; unzip -tq TinNhan-macOS-arm64-0.5.0.zip PASS. gh release create v0.5.0 with --draft, --target and --notes-file PASS; API release-list lookup plus Python assertions verified both asset uploaded states, byte sizes and GitHub digests equal local files. gh release edit v0.5.0 --draft=false --latest PASS; gh api repos/mhfed/tin-nhan-desktop/releases/tags/v0.5.0 confirmed draft=false, target and both download URLs/digests. ZIP SHA25669caae603b21e890f5ab9c0850fc5cec209bd2a0860b696d236f23442204ae96. git diff --check required before documentation commit; remote main/README verification follows push. Runtime tests not rerun for release/docs-only work; existing0.5 evidence above.

Rework1 verification adjustment: tag endpoint returns404 for unpublished draft, used authorized release list before publishing. Actual tokens unavailable. Existing signed arm64/ad-hoc/notarization limits unchanged. Next gate: documentation pushed and remote README download verified; user can download public0.5.0.

## Development fixes — 2026-10-26

Fixed Telegram authentication detection when chat messages contain QR/login instructions: explicit login forms still take priority, but existing chat controls now precede fallback page-text matching. Added two regression tests; the tutorial-text case failed before the fix and passed afterward.

Installed dependencies from the existing lockfile and downloaded the pinned Electron binary. Persistence tests now use a unique temporary directory with cleanup instead of deleting a fixed sibling directory. Test screenshots and prototype output stay under the repository's ignored `outputs/`, which is also excluded from Forge packages. Theme and window-lifecycle fixtures use an isolated home; lifecycle also intercepts provider HTTPS pages. Prototype checks use Playwright's installed browser or `TIN_NHAN_CHROMIUM`. Updated test/setup documentation and kept the personal live harness separate.

Verification: typecheck PASS; unit tests PASS44/44; build PASS; persistence write/read PASS; desktop, multi-account, shell/command-focus, window-lifecycle, theme and sidebar-layout fixtures PASS. Prototype build and browser checks PASS12 variants with the installed Chrome executable in a temporary headless profile. Changed JavaScript syntax/format checks and independent read-only review passed; no blocking findings. No personal sessions or real messaging were used.

Production account IDs, partitions, startup/background behavior and notification routing are unchanged. Provider DOM compatibility, service-worker/cold-start notification limits and resource growth with account count remain existing constraints. No package, version bump, commit or release was created in this fix pass; the published0.5.0 asset is unchanged.

## Background performance optimization — 2026-10-26

User authorized implementation of the performance audit, prioritizing background CPU then RAM and preserving sessions/drafts. Implemented semantic state deduplication with bounded 25ms polling coalescing; unchanged Dock/native layout/DOM writes are skipped. Combined auth/unread/optional theme in one page probe, made auth body text lazy and limited theme sampling to the active visible platform-theme account. Startup background-throttling exemption now expires after 30s or authentication. Existing provider views and partitions remain live; no unload/freeze/reload or storage migration was introduced.

Independent review found two regressions, fixed with RED/GREEN tests and real Electron checks: rejected OS preferences must force authoritative checkbox acknowledgement despite unchanged state; explicit theme refresh during an in-flight probe must queue a follow-up. Added focused main/probe/renderer regressions and a reusable native benchmark (`npm run test:performance`), with temp home/appData and local fixtures only.

Verification: final typecheck PASS, unit59/59 PASS, build PASS; persistence write/read, desktop, multi-account, shell12 variants, command-focus, theme, sidebar-layout, window-lifecycle and renderer-performance fixtures PASS. Before/after benchmark: 16 static samples +4 login-animation samples, all session/draft/view identity assertions pass (108 account observations). Final build hashes match the measured optimized snapshot. No personal account or live provider tests were performed.

Static hidden-window results per20.4s (3/6/12 accounts): JS evaluations45/90/180→15/30/60; unchanged state IPC20/35/65→0; DOM records1200/2835/7995→0. Synthetic login animation: median CPU4.147%→0.021%, frames2449→0, wakeups330/s→4/s; foreground resume confirmed on the same view twice. These are fixture measurements, not real-provider battery claims. Summed working sets vary and are not private footprint; resident RAM did not decrease consistently. Keeping all live pages protects drafts and notification/call behavior.

Full report: `docs/performance-2026-10-26.md`; raw data, comparison JSON, build snapshots and hashes: ignored `outputs/performance-comparison/`. No commit, package, version bump or public release update in this pass; published0.5.0 is unchanged.

## Local optimized package 0.5.1 — 2026-10-26

User requested an installable trial. Bumped package.json and both lockfile version fields to 0.5.1 without dependency changes; built the macOS arm64 app and ZIP using existing Forge configuration. Bundle ID `local.mhfed.tinnhan.desktop`, `Tin Nhan` executable/product name, `TinNhanDesktop` userData path and account partitions remain unchanged. No personal profile was opened, app installed, commit created or public release updated.

Verification: typecheck PASS; unit tests59/59 PASS; npm run make PASS. Original and ZIP-extracted app pass `codesign --verify --deep --strict`; Info.plist and ASAR report 0.5.1 and executable is arm64. All six runtime entry/style/HTML hashes match the measured optimized build. ASAR contains no account storage, test outputs, source, tests or scripts. ZIP integrity and SHA-256 check PASS. Read-only packaging review confirmed identity/storage settings; draft recovery after a full quit still depends on providers, so copy important drafts before upgrading.

Delivery: `outputs/TinNhan-macOS-arm64-0.5.1.zip` (119918303 bytes), `outputs/SHA256SUMS-0.5.1.txt`, extracted `outputs/TinNhan-0.5.1/Tin Nhan.app`, verification inventory `outputs/TinNhan-0.5.1/package-verification.json`. ZIP SHA-256: `e4cbfd7143742575b8dde96f33793c6d6ae1a29a357af0c2e0e314003d7613c6`. Build is ad-hoc signed, not Developer ID notarized. README/report/handoff delivery notes were updated after packaging; runtime matches the measured and tested artifact.

## EVKey compatibility fix and unified chat design — 2026-10-26

User reported EVKey stopped typing Vietnamese across all apps while Tin Nhan was open and recovered after Cmd+Q. Native isolated fixtures reproduced Chromium holding OS Secure Input after hide/minimize and hidden password focus. Carbon/IORegistry confirm the state; Electron app.isSecureKeyboardEntryEnabled() alone incorrectly remains false for this path. Playwright's altered focus metadata was excluded from root-cause confirmation. Enabling throttling from construction and a DOM-only blur guard were insufficient.

Implemented `src/main/macos-input.ts` and bootstrap before app.ready: on exact darwin/Electron45.0.0/Chromium156.0.8078.48 only, merge `RWHVMacHasFocusReturnsFalseForNonKeyWindow` into disable-features. This restores native cleanup semantics; it does not disable Secure Input/password protection. No DOM/view/layout/partition/session or warmup change. Independent source and code review found no blocker; exact runtime gate requires rerunning native regression on Electron upgrades. Details and pinned Chromium/Apple references: `docs/evkey-2026-10-26.md`.

Verification: unit62/62, typecheck/build and diff check PASS. New `scripts/ime-check.mjs` + `ime-entry.cjs`: 37/37 native cases PASS twice on final implementation, including main-window blur/hide/minimize/close, background password refocus, shadow root, cross-origin iframe, popups and protection restored on return. Each case retains fixture drafts/password values/cookie/localStorage/webContents IDs. Baseline0.5.1 shows8 genuine secure-state mismatches plus4 foreground-related positive-check failures, not12 confirmed Secure Input failures. Evidence `outputs/ime-regression/{before,after,final}/result.json`. Command-focus, window-lifecycle, persistence write/read, desktop and renderer-performance checks PASS. Renderer harness needed installed headless Chrome via TIN_NHAN_CHROMIUM because Playwright browser binary was absent. One native performance regression sample (20.4s hidden login animation) reports CPU0.0158%, frames0, unchanged state IPC0, DOM0, probes15; foreground resume confirmed. No personal sessions, live messages or actual EVKey keystrokes were tested.

User chose unified chat DESIGN before any UI change. Created independent interactive prototype `outputs/unified-chat-design/index.html` with fictional data, account filters/search, one shared chat/composer, per-thread in-memory drafts, demo-only send, dark mode and official-login handoff explanation. Design spec: `docs/superpowers/specs/2026-10-26-unified-chat-design.md`. Official feasibility review: Telegram TDLib supports custom clients; checked Messenger/Zalo APIs target Pages/OA, so personal connectors remain unverified. No production redesign/adapters approved or implemented. Headless interaction/layout checks and root visual inspection PASS1280×800 and1024×720; no page errors or external requests. Preview served only on127.0.0.1:4175; Codex browser tab open requested (queued). Prototype excluded from installer.

Local0.5.2 package: `outputs/TinNhan-macOS-arm64-0.5.2.zip` (119923629 bytes), SHA-256 `89d3be51fdf7f861040ba0113040b13aadc57b8c3e34c5bced81c4579bd54c0e`, checksum `outputs/SHA256SUMS-0.5.2.txt`, extracted app `outputs/TinNhan-0.5.2/Tin Nhan.app`. ZIP integrity, extracted app deep/strict ad-hoc signature, arm64 executable, version0.5.2, unchanged bundle ID and package inventory PASS. Runtime matches all six previously tested dist hashes in `outputs/TinNhan-0.5.2/tested-build-sha256.json`; inventory in `package-verification.json`. package.json/lock version fields match, no dependency changes. No install, commit, push or public release. User should copy important drafts before quitting old app, install replacement retaining existing app data, and confirm actual EVKey typing. Final report/handoff updated after packaging; runtime unchanged.

## Unified chat visual design approved — 2026-10-26

User rejected Liquid Glass, chose A (Mac tối giản), requested selectable Zalo/Telegram tabs, then explicitly confirmed “Chốt nhé” on the revised native prototype. Approved design is two columns, neutral white/gray system typography, blue selected conversation, platform tabs All/Zalo/Telegram/Messenger above search, separate account selector beneath title, matching header/send route, remembered conversation per tab and per-thread draft retention when switching. Accepted snapshot: `outputs/unified-chat-design/approved/index.html`, `preview.png`, `approval.json`; working preview `outputs/unified-chat-design/directions/native.html`. Specification updated at `docs/superpowers/specs/2026-10-26-unified-chat-design.md`. Prior designs are alternatives, not the chosen baseline.

Prototype checks already pass for provider/account/search/status filters, correct thread/route, independent in-memory drafts, last thread per provider, empty state, keyboard navigation, demo-only send, 1280×760 and1024×720 layout, and gallery interaction via file/HTTP. All CSS/JS embedded to work inside sandboxed preview; actual interactive iframe uses native sizing on desktop to avoid transformed hit-testing issues. No runtime production changes, personal session access, installation, new package, commit or release in the design approval turn. Next implementation work must resolve actual provider data connectors; a visual approval is not evidence that personal Zalo/Messenger APIs or web-cookie migration are supported. Keep existing session partitions and real drafts protected.

## Technology decision — 2026-10-26

After discussing Electron/Tauri/SwiftUI tradeoffs, user explicitly chose to keep Electron for the initial phase (“thôi đầu tiên để electron đã”). Approved visual direction remains Mac tối giản with platform tabs and account selector. Record this as the current implementation constraint; no framework migration requested. Session/draft preservation and background CPU/RAM priorities remain in force. Design spec updated; no runtime or package changes in this decision turn.

## 2026-10-26 — unified connector research checkpoint

User approved experimental Zalo/Messenger personal web connectors, release only after verification; deferred manual login/test conversation selection for now. Production UI/version/installer remain 0.5.2; do not say unified chat is finished. See `docs/connector-progress-2026-10-26.md` and `docs/superpowers/plans/2026-10-26-unified-connectors.md`.

New unintegrated modules: account/conversation/topic keys, encrypted-codec atomic draft store with revision/tombstone protection, and bounded read-only Zalo visible-inbox parser. Real Zalo one-shot check returned 13 conversations (utility row excluded), no selected message pane, no send/history validation. Messenger is logged out. Telegram native smoke passes Electron 45 arm64 with tdl 8.1.0 / prebuilt-tdlib 0.1008069.0, no credentials/auth/data requests. Native dependency minimum macOS 14; no production packages installed.

Verification at this checkpoint: 89 app tests plus 9 isolated CDP diagnostics tests pass; typecheck/build pass. Diagnostic tooling is now attach-only with deadlines/cleanup; root verified exiting it leaves the same app PID alive. Evidence in outputs/zalo-live-evidence.json and outputs/telegram-native-verification.json. Do not copy private page data into fixtures/logs; all persisted live results contain only structure/counts. Existing app was opened for inspection without changing web drafts, cookies or partitions. No real sends. Need real auth/history/routing/ACK evidence and production integration before new installer.


## 2026-10-26 — scope replacement: per-platform chat, 0.5.3

User explicitly cancelled unified chat: “k cần chat thống nhất nữa, chat riêng từng nền tảng”. This supersedes the connector release gates above. Keep Electron and the approved minimal macOS visual direction. New shell uses a 64px toolbar with Zalo / Telegram / Messenger tabs, provider-scoped account selector, native page action menu, and retained settings/command palette. Native provider views occupy the remaining window, with no app sidebar. Login partition IDs and userData unchanged. Research modules stay unintegrated and docs/scripts are excluded from the package.

Implementation complete. See docs/release-0.5.3.md. Fresh verification: typecheck,90 unit tests,11 native-tab cases,renderer performance,command focus,multi-account,desktop,persistence write/read,window lifecycle and37 native IME cases PASS. Fixed two issues found by fixture: arrow-tab focus must remain in shell, and native menu shortcuts must not cover an open account editor. Independent review found only obsolete archive wording, now corrected.

Paired synthetic activity smoke:0.5.2→0.5.3 CPU0.02245%→0.02146%, summed working set635.56→623.72MiB; both0 stateIPC/DOM mutations/activity frames,15 probes,4 idle wakeups/s; sessions/drafts/view identities retained and visible animation resumed. One sample20.4s after32s warmup, not statistical improvement or real-provider performance claim.

Packaged outputs/TinNhan-macOS-arm64-0.5.3.zip (119883337bytes), SHA256 9501d65a0b5631479a3db59f279d808851ecee2c7808d9fecead70be7914db6b. ZIP integrity,deep/strict ad-hoc signature,arm64,version/bundleID,excluded research inventory and six tested runtime hashes PASS. Test app extracted at outputs/TinNhan-0.5.3/Tin Nhan.app. No install/launch with personal profile, no commit/push/public release. Separately running0.5.2 personal app was not stopped or replaced. Tests used temporary profiles and synthetic HTTPS pages.

## 2026-10-26 — DMG and manual updates, 0.5.4

User approved certificate-free distribution: DMG, update discovery and browser download; user replaces app manually. Implemented fixed public GitHub Releases checker, settings/menu/palette UI and optional 30-second startup / 12-hour schedule with due time preserved through sleep. No auto-install, auto-restart, release publication or change to personal data. Keep Electron45 and EVKey workaround, bundle ID and partition/userData identities.

See docs/release-0.5.4.md and docs/distribution.md. Fresh verification: typecheck, 121 unit tests, 9 isolated manual-update groups, 11 native-tab groups, command focus, renderer performance, persistence and lifecycle PASS. Native tab runs initially lost OS foreground; isolated rerun passed without changing production/focus assertions. Actual public API returns v0.5.0 and local0.5.4 correctly reports ahead. IME native/CPU benchmark not repeated for this feature; prior0.5.3 evidence remains scoped to that build.

DMG/ZIP at outputs/TinNhan-macOS-arm64-0.5.4.{dmg,zip}; checksums outputs/SHA256SUMS-0.5.4.txt. DMG verified/mounted read-only, app and Applications link present, deep/strict ad-hoc signature valid. All11 runtime files match tested dist and ASAR inventory contains only runtime plus package.json. Metadata under outputs/TinNhan-0.5.4. No public0.5.4 Release, no install over /Applications/Tin Nhan.app, no personal profile launch/quit. Git tree retains earlier authorized uncommitted work.


## Gom branding 0.6.0 — 2026-10-26

User approved the Gom name, rounded g/chat logo and teal/mint/ivory palette, then requested implementation. Rebuilt the mark as assets/gom-mark.svg; generated Dock ICNS/iconset and shared tray/settings mark. Product/executable, menus/About, notification copy, renderer and installers now display Gom. Both light/dark palettes applied while retaining provider-adaptive themes and the compact platform tabs.

Critical compatibility: preserve app.setName("Tin Nhan") BEFORE ready because Electron45 derives macOS encryption Keychain names from it; display name comes from Gom bundle metadata/explicit menu labels. Bundle ID, TinNhanDesktop userData, account IDs and partitions remain. Updater recognizes Gom and legacy prefixes; canonical DMG has a byte-identical TinNhan alias for old0.5.4 discovery on future public releases. No publication performed.

Verification: typecheck/build,128 unit tests,12 native-tab cases,command-focus,9 update integration cases,multi-account restart/storage and persistence write/read all PASS. All Electron fixtures executed this turn use temporary profiles and --use-mock-keychain; runtime assertions separately pin the legacy internal encryption name. Independent code and package review passed after resolving alias/upgrade instructions. Final packaged ASAR fixture confirmed Gom menu/window, bundled SVG and light/dark views; no page errors.

Gom0.6.0 DMG and ZIP under outputs/, checksum outputs/SHA256SUMS-Gom-0.6.0.txt. Deep/strict ad-hoc signature,arm64/version/bundle metadata,12 runtime file hashes,packaged icon,ZIP integrity,DMG checksum and readonly mounted contents/Applications link all PASS. Canonical and alias DMG SHA256 b857cce18968bd2cb263095caf0a0628a0f0afe697ee54da0ab52aca3f9b58df; ZIP ea92b8de02b8688a3d5f16e7f3e2266736da4cf54431ba8c87c14fb2d9d4d0b3. Full report docs/release-0.6.0.md; proof/screenshots outputs/Gom-0.6.0/.

No personal profile/real Keychain access, installed-app replacement, live send, public release,commit or push. Ad-hoc code-signing authorization may still prompt on personal upgrade; provider session expiry/full-quit draft restoration remain provider-dependent. Existing uncommitted0.5.4 work preserved.


## 2026-10-26 — public Gom 0.6.0 release

User explicitly requested pushing everything, then clarified waiting for the parallel Gom branding task and publishing all source plus the newest installer. Waited for that task to complete. Committed all 99 source/assets/docs/test changes as 490b1df760b479ee64b44c91b2e003e162be6e45, pushed main and annotated v0.6.0 atomically. No profile/output artifacts in Git. Public stable Latest release: https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.6.0, ID424111791; includes Gom DMG/ZIP, byte-identical TinNhan compatibility DMG and SHA256SUMS-Gom-0.6.0.txt.

Fresh 128 unit tests/typecheck/build PASS; rebuilt runtime equals packaged ASAR. GitHub digest/size verification matches all four uploads. Public DMG HTTP200. Live unauthenticated updater verification: Gom0.6.0=current; original packaged TinNhan0.5.4=available0.6.0, using compatibility asset. Evidence outputs/publish-0.6.0. README/download/distribution links updated after publication. No force push, app install, personal session access or change to repo visibility.
