# Floating Chat Implementation Plan

**Goal:** Ship the approved floating native tab and corner bubble, then build and install on this Mac.

**Spec:** `docs/superpowers/specs/2026-10-29-floating-chat-design.md`

**Architecture:** One controller owns a panel and bubble window; the existing account WebContentsView changes parent without reload. Main retains account/session authorization and excludes detached views from main layout. Dedicated preload authorizes only owned local windows.

## Tasks

- [x] Baseline: run full unit suite; isolated Electron regression first fails because floatChat does not exist.
- [x] Controller: geometry tests RED/GREEN; safe workArea placement, reparent, collapse/expand/pin/return, lifecycle and trusted IPC.
- [x] UI: toolbar entry, main placeholder, 45px floating shell and 60px logo bubble with drag/snap; preserve official provider page.
- [x] Integration: shared bridge/state, main layout cache invalidation, account actions/privacy/quit and focus; bundle explicit runtime assets.
- [x] Validation: typecheck, full tests, floating Electron smoke and existing private-space regression; fresh independent review and fixes.
- [x] Delivery: bump local version 0.8.0, build DMG/ZIP, verify runtime allowlist, integrity/signature and packaged smoke, back up/install/reopen Mac app.

## Review focus

Same view/token/draft across every transition; normal floating persists main hide; private lock and stale IPC never reveal old content; detached view never appears in two parents or receives main bounds; closing account/provider and quitting leaves no orphan windows; bubble clamps to workArea including negative display origins and display changes.

## Progress

- Mock approved directly by user. Native provider UI replaces fictional sample messages from the mock.
- Existing unrelated untracked logo/distribution plans are preserved.
