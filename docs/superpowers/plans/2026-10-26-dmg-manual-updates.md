# DMG and Manual Updates Implementation Plan

> **For agentic workers:** Implement the independently assigned tasks below in this session; preserve all prior dirty work.

**Goal:** Deliver0.5.4 DMG and manual update discovery without Apple certificate or forced restart.
**Architecture:** Pure release validation + bounded checker in main, trusted IPC to existing settings UI. Forge DMG alongside ZIP. No updater that installs code.
**Tech Stack:** Electron45, TypeScript, Electron Forge8, Node fetch, node:test, isolated Electron fixtures.
**Spec:** ../specs/2026-10-26-dmg-manual-updates-design.md

## Global Constraints
- Preserve userData, partition IDs, background optimizations, EVKey workaround and drafts in running views.
- Repository fixed mhfed/tin-nhan-desktop; no credentials, cookies, renderer-controlled URL or remote HTML.
-0.5.4 arm64; manual install only; ad-hoc signing disclosed.

## Review Focus
- Malformed release/unsafe links/prerelease: reject, never execute/render HTML.
- Current version ahead, absent compatible asset, offline/rate limit: truthful distinct states.
- Concurrent checking, cancellation and oversized responses: bounded work with meaningful tests.
- Settings dialog/native views and unsaved account names: preserve visibility/focus/drafts.
- Installer inventory/mount/content/hash/signature: match tested build and exclude profiles.

### Task1 — release checker
- [ ] Add src/main/update-check.ts and src/update-types.ts with unit tests first (version parsing, metadata validation, asset architecture, fetch failure/size/timeout/coalescing).
- [ ] Implement ManualUpdateChecker.check(), cancel(), snapshot and onChange callback; no Electron dependency.
- [ ] Verify focused unit tests.

### Task2 — packaging
- [ ] Add pinned Forge DMG maker; bump package/lock to0.5.4; keep ZIP and ad-hoc signing.
- [ ] Configure DMG app/Applications shortcut and neutral installation instructions.
- [ ] Produce installation/update publishing docs with consistent asset names. No upload.

### Task3 — integration
- [ ] Add update state and trusted check/open-release IPC, persist automatic-check preference with normalization tests.
- [ ] Add settings tab, status/notes/download button, menu action and unobtrusive badge.
- [ ] Schedule startup/12hour checks only in packaged app, cancel on quit; no session/quit lifecycle changes.
- [ ] Add isolated integration fixture covering available/current/ahead/error/retry/links/drafts/modal and safe notes.

### Task4 — release gate
- [ ] Run typecheck/unit/fixture/native-tabs/persistence/IME and renderer DOM regression as relevant.
- [ ] Make DMG+ZIP; read-only mount/verify image, app codesign and all tested runtime hashes; checksum artifacts.
- [ ] Report ready-to-share local installer and what publication remains; do not overwrite running app.
