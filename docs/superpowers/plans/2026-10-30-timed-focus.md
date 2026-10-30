# Timed Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add persistent, timed Focus to Gom without changing per-account notification choices or manual pause.

**Architecture:** Main-process FocusSchedule owns absolute end time, validation, expiry and lifecycle. Preferences store optional focus metadata for backward compatibility; derived policy controls notifications and audio. Settings, command palette and tray share the same validated command.

**Tech Stack:** Existing Electron 45, TypeScript, node:test and Playwright Electron fixtures; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-timed-focus-design.md` (approved 2026-10-30).

## Global Constraints

- 30 minutes, 1 hour or a custom end within 24 hours; optional audio muting defaults off.
- Preserve independent manual pause, per-account permissions, private-space policy, session identities and drafts.
- Survive restart; expire on timer or wake; no page reloads or OS preference changes.
- No recurring working-hours schedule in this version; no personal sessions in fixtures.

## Review Focus

- Restart or wake after expiry restores sound without enabling manually paused notifications.
- Changing account, workspace, popup or floating state never bypasses optional audio mute.
- Expiry cannot broaden per-account notification permissions; a permission dialog opened before Focus cannot grant during Focus.
- Invalid IPC/settings dates cannot start an infinite session or overwrite a valid active one.
- Delayed reminder delivery respects Focus changes during its asynchronous claim/write.

### Task 1: Focus scheduler and policies

**Files:** Create `src/main/focus.ts`, `tests/focus.test.ts`; modify `src/shared.ts`, `src/main/preferences.ts`, `src/main/notification-policy.ts`.

**Interfaces:** `FocusSession { endsAt: number; muteAudio: boolean }`; `FocusSchedule` accepts change callback, injectable clock and timer; provides restore/start/stop/refresh/dispose. `notificationsPaused(preferences, now?)` combines manual pause and active Focus.

- [x] Write failing tests for validation, normalization, exact expiry, early/stale callbacks, reschedule, restart, clock changes and disposal.
- [x] Observe RED, implement scheduler and optional preference field, and verify policy preserves account choices.
- [x] Run focused unit tests and typecheck; expected PASS.

### Task 2: Main process integration and native fixture

**Files:** Modify `src/main/main.ts`, `src/main/preload.ts`, `src/shared.ts`; create `scripts/focus-check.mjs`.

**Interfaces:** `DesktopBridge.focus(action: "start" | "stop", data?: FocusSession): Promise<AccountResult>`; main validates all IPC, updates metadata, schedules expiry, reapplies audio and persists.

- [x] Write a failing isolated Electron fixture for bridge start, manual pause, permission denial, rejected inputs and expiry; use injected fixture clock/timers at host boundary.
- [x] Wire notification/reminder gates, permission prompt final checks, start/restart/wake/quit, tray, and all view/popup audio paths.
- [x] Cover restart, drafts/view identity, private transition, popup and floating audio in the fixture.
- [x] Run fixture; expected PASS without real alerts, clipboard changes or account access.

### Task 3: Settings and command UI

**Files:** Modify `src/renderer/index.html`, `src/renderer/shell.css`, `src/renderer/shell.ts`, `src/renderer/command.ts`; create `src/renderer/focus.ts`; extend `scripts/focus-check.mjs`.

**Interfaces:** `createFocusUI().sync(state: AppState)` renders settings controls and toolbar status; submits only main-owned validated focus commands.

- [x] Add failing fixture checks for preset/custom start, validation, change end, early stop, keyboard access and command palette actions.
- [x] Add settings form matching existing UI, toolbar indicator linking to settings, and command actions. Preserve in-progress custom input across state updates.
- [x] Run fixture at normal and narrow supported widths; inspect screenshots.

### Task 4: Documentation, regression and review

**Files:** Update `README.md`; create `docs/timed-focus.md`; update this plan and verification notes.

- [x] Run `npm run typecheck`, `npm test`, `npm run build`, focus fixture and existing desktop/settings/reminder/private/floating checks appropriate to changed paths.
- [x] Request one independent read-only whole-change review, fix actionable findings with regression coverage, and rerun affected checks.
- [x] Document exact verification and remaining live-platform/OS limits. Leave completed source reviewable on branch `codex/timed-focus`; no release/install requested.

## Execution record

- Approved by user: “Duyệt, triển khai theo thiết kế”. Native inline execution; no further plan approval needed.
- Baseline: typecheck PASS; unit tests 248/248 PASS.
- Workspace ruling: native worktree was created but sandbox denied writes. Implementation used original checkout on `codex/timed-focus`; the app refused to archive its primary attached worktree. After verification, move the clean attached checkout to the verified feature commit using approved filesystem access. Existing untracked documents remain untouched.
- Task 1: complete — 7 scheduler/policy tests, observed missing-feature RED then GREEN; baseline 248 tests becomes 255.
- Task 2: complete — native bridge/policy fixture observed RED then GREEN; permissions, restart, wake, audio, privacy and reminders covered.
- Task 3: complete — settings and command UI observed RED then GREEN; 18 native groups include screenshots at 940px/1280px. Fixed keyboard focus, tray audio-choice preservation and title ranking based on reproductions.
- Final review: one independent read-only reviewer; one Important custom-date constraint finding fixed through native clock-advance RED→GREEN. No deferred minors. Real-provider/OS delivery and recurring schedules remain outside this source-only implementation as recorded in the approved spec.
- Verification: see `docs/verification-timed-focus.md`; legacy settings harness failure reproduced on unmodified HEAD and is not a Focus regression.
- Native-tabs regression: unchanged snapshots initially produced 40 redundant Focus DOM mutations; a relevant-state render guard fixes this. Existing zero-mutation regression observed RED→GREEN; native tabs 16/16 PASS.
