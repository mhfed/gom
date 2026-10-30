# Compact Header B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. One independent whole-branch review at the end.

**Goal:** Implement the selected single-row B mock without changing loaded native pages.

**Architecture:** Compact active/inactive tab widths; existing native menus return typed HeaderAction after guarded dismissal; renderer helpers replace removed toolbar buttons. Keep native geometry unchanged.

**Tech Stack:** Existing Electron/TypeScript/HTML/CSS/node:test/Playwright, no dependencies.

**Spec:** docs/superpowers/specs/2026-10-30-header-compact-design.md

## Global Constraints

- Header stays 52 px; Mac native-control inset stays 94 px.
- Active provider label remains visible even if pinned; inactive provider logo slots 34 px, bounded active width.
- One add entry; account and tools actions only after menu dismissal and account/panel/epoch guards.
- Preserve sessions/IDs/views, draft state, per-workspace privacy, notification/Focus/sleep semantics.
- User chose B from the reviewable mock; execute locally, no repeat approval. Reuse existing managed worktree.

## Review Focus

1. Pinned/custom active platform and many icons must not clip active tab — Task 1 layout and Task 2 native geometry.
2. Late native menu click after privacy/account/page change must do nothing — Task 2 stale-menu fixture.
3. Native menu action opening editor/floating/settings must retain correct keyboard focus — Task 2 action + Task 3 regressions.
4. Empty/private workspace and sleeping/crashed views still allow global tools, without creating pages — Task 2 capability fixture.
5. No-op snapshots must not churn header DOM or rebuild native views — Tasks 1/3 identity/mutation checks.

### Task 1: Compact tabs

Files: src/renderer/provider-tab-layout.ts, provider-navigation.ts, shell.css; tests/provider-tab-layout.test.ts.
Interface: compactProviderWidth(measuredLabelWidth:number, active:boolean):number; existing fitProviderTabs contract unchanged.

- [ ] Test eight-provider fit and active/custom fit at constrained widths; observe RED.
- [ ] Implement 34px icon slots and bounded active labels, update widths on selection without rebuilding; remove close buttons and preserve context-menu/keyboard management.
- [ ] Targeted tests GREEN, typecheck; commit.

### Task 2: Menus and toolbar

Files: src/shared.ts, src/main/main.ts, src/renderer/shell.ts, focus.ts, index.html; scripts/header-check.mjs.
Interface: HeaderAction union; providerMenu/accountMenu/navigationMenu return Promise<HeaderAction|void>. providerMenu accepts add?:boolean. Menu handlers use existing renderer helpers after guarded dismissal.

- [ ] Write synthetic Electron fixture and observe missing compact header/menu RED.
- [ ] Implement native add/account/tools choices; epoch/context guard; replace removed DOM handler endpoints with helper functions; keep active Focus and update badge.
- [ ] Verify layout, actions, stale callbacks, privacy/empty/sleeping scenarios, native view/draft identity and screenshots.
- [ ] Commit implementation + fixture.

### Task 3: Verify and deliver

Files: relevant old fixtures, README, docs/header-compact.md and docs/verification-header-compact.md.

- [ ] Migrate fixture entry points to real menu interactions, not hidden button stubs.
- [ ] Full unit suite/typecheck/build/format + header/native/Focus/resource/backup/floating checks; record existing OS-focus harness instability where observed.
- [ ] One fresh read-only reviewer; fix Important/Critical with RED→GREEN; record rulings/minors.
- [ ] Save final local source commit, preserve worktree and hand over screenshot.
