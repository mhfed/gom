# Background performance implementation plan

**Goal:** Reduce idle CPU work first, then memory churn, while preserving account sessions, live drafts, notifications and calls.

**Architecture:** Keep existing Electron views and persistent partitions. Publish only changed state, combine page probes, bound startup background exemptions, and update native/renderer UI only when values change. Retain one current snapshot/cache entry per live object; never unload a provider to claim a RAM improvement.

**Authorization:** User requested implementation of the preceding audit in order, with before/after measurement and session/draft preservation. Continue in this working directory to preserve the earlier uncommitted fixes. No release, commit, real-account access, or dependency changes are required.

**Tech stack:** Existing Electron 45 / TypeScript / esbuild / node:test. Native isolated Electron fixtures for measurement.

## Constraints and review focus

- Preserve unknown unread versus zero and all origin, epoch, current-view and single-flight guards.
- Navigation, account switches and user actions must still publish promptly; a stalled probe must not block other accounts.
- Theme sampling follows the active account in platform mode, refreshed on selection/show/theme change.
- Startup background exemption expires after 30 seconds even on login/error pages; authenticated pages end it earlier. No reload, freezing, storage deletion or zero-sized background views.
- Keep draft text, page JavaScript state and webContents identities across switches/hide/show; persistent cookies, localStorage and IndexedDB must survive restart.

## Tasks

- [x] Preserve baseline build and measure it with the same native fixture harness used for the optimized build (3/6/12 accounts and login pages; two repetitions).
- [x] Add regression tests for semantic state publication, lazy auth text, combined snapshots, bounded warmup and unchanged native layout. Observe failures, then implement these changes in main helpers/main.ts.
- [x] Reduce renderer writes and command selection work with a real-DOM regression; maintain fresh settings and account badges.
- [x] Verify RAM ownership: weak layout cache, bounded publication cache, no history retention, no account unloading. Measure resident memory rather than promise a reduction.
- [x] Run typecheck, unit tests, build, isolated persistence/desktop/multi-account/shell/theme/layout/lifecycle checks and native after measurements.
- [x] Independently review the complete performance diff, resolve material findings, and document before/after results and limits.

## Measurement

Use direct Electron launches, temporary appData/home and local HTTPS fixtures. No Playwright background flags in the measured process. Count state IPC, page evaluations and DOM mutation records, and collect process CPU/wakeups/working sets across fixed intervals. Working-set sums may double-count shared pages. Static fixture CPU and short samples do not establish real-provider battery savings or leaks; report repeated ranges and avoid attributing noise to improvements.

## Decisions

- Retain provider pages: closing a page can lose an unsent draft and stop notification/call delivery. Large resident RAM reductions through unloading are incompatible with the preservation requirement in this pass.
- Combine only polling publication with a short bounded queue; keep command/event publication immediate and semantic deduplication global.

## Verification ledger

- Main helper regressions observed RED, then GREEN; renderer real-DOM regression observed 63 mutations on unchanged state before, 0 after. Auth/snapshot tests observed RED then GREEN.
- Independent review found two material regressions: repeated rejected OS preferences needed authoritative acknowledgement despite identical state, and an explicit theme refresh during an existing probe needed a queued follow-up. Both fixed with RED/GREEN unit coverage plus real Electron regressions in desktop/theme checks.
- Current unit suite 59/59 and typecheck/build pass. Isolated persistence, desktop, six-account, shell (12 variants), command focus, theme, sidebar layout, window lifecycle and renderer performance checks all pass. Personal sessions were not used.
- Native measurement complete: 8 baseline + 8 optimized static samples and 2 baseline + 2 optimized animation samples, all preservation checks passed. Optimized animation samples also confirmed foreground frame resumption on the same view. No product changes during measurement; final build hashes match the measured snapshot.
- Findings and repeated ranges are recorded in `docs/performance-2026-10-26.md`. Idle IPC/DOM work is eliminated, authenticated probes fall by 2/3, login animation CPU falls in the synthetic fixture; resident RAM does not show a consistent reduction. No account unloading or release was performed.
