# Complete Reply Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan. Steps use checkbox syntax.

**Goal:** Finish the paused account-bound reply reminders on top of released Gom 0.8.1.
**Architecture:** Reuse the approved WIP store/service/modal, integrate with current shelf/floating/native surfaces, and finish privacy-safe durable delivery. Keep manual account selection and explicit notes; no chat scraping or automatic sending.
**Tech Stack:** Electron 45, TypeScript, built-in Node filesystem/crypto, existing vanilla renderer and isolated Electron/Chrome fixtures; no new dependencies.
**Spec:** `docs/superpowers/specs/2026-10-29-reply-reminders-design.md` from WIP 20aebfb, explicitly resumed by user “hoàn thiện Nhắc trả lời đi chứ”.

## Global Constraints

- Preserve Gom 0.8.1 shelf, mobile-popup reload and 36 px bubble behavior. Keep all account/session identities, published tag/assets and four original untracked documents unchanged.
- Reminder note 1–500 Unicode codepoints, due time in future ≤366 days; max 500 items and 1 MiB store envelope. Normal reminders notify only while Gom running, respecting global pause; overdue on restart handled once.
- Private reminders never emit OS notifications. Snapshot/badge/list/actions only current space; archived reminders manageable but cannot open/notify.
- Store encrypted via OS safeStorage, serialized atomic writes, fail closed preserving original bytes. Use Electron 45 async encryption APIs, accepting sync or async injected codecs for tests.
- Preserve LF/tab and normalize CRLF/CR; other control/bidi normalization must not join words. Custom reschedule uses existing snooze action with chosen future dueAt.
- Every renderer action captures `lockVersion`. Service validates current epoch at entry and again through a guard at durable mutation; switch away-and-back rejects stale requests.
- No version bump, installer, release, installation, real reminders/messages or real userData in this task. Source build and synthetic verification only.

## Review Focus

- Claim saved before notification and invalidated by workspace/account/pause/change while awaiting encryption/I/O; safe conditional release preserves retry without duplicates.
- Closing app drains in-flight delivery/store work; no new notifications or writes after revoked capability.
- Reminder modal masks every native view, closes shelf before opening, returns floating page once, and leaves destination/focus intact on close/failed open/hide.
- Repeated identical snapshots cause no DOM mutations, including closed modal; actual account/note/due changes still update.
- Custom local datetime validation, empty/long/multiline notes, archived accounts, corrupt storage and async crypto failures remain usable and inert.

### Task 1: Restore and integrate existing WIP (root)

**Files:** all conflict sites in `src/main/main.ts`, `src/main/preload.ts`, `src/shared.ts`, `src/renderer/{shell.ts,index.html,shell.css}`; existing private-state projection/tests; this plan.
**Interfaces:** retain `DesktopBridge.reminder(action,data)` and `ReplyReminder`/`ReminderSnapshot`; data.lockVersion used for every request. Main supplies `ReminderService` option `currentEpoch:()=>privacyGeneration`, async codec, existing account guards and notification callbacks.

- [x] Restore WIP 20aebfb on feature branch based on main cb84830; resolve conflicts preserving both shelf and reminders. Keep old WIP branch untouched.
- [x] Build/typecheck integrated baseline; wire service epoch, crypto and surfaces after worker changes. Avoid duplicated imports/helpers.
- [x] Add integration regressions for shelf/modal coexistence and native/floating focus; preserve all 0.8.1 behaviors.

### Task 2: Durable store and delivery service

**Files:** `src/main/reminders.ts`, `src/main/reminder-service.ts`, `tests/reminders.test.ts`, `tests/reminder-service.test.ts` only (dedicated agent).
**Interfaces:** `ReminderCodec.encrypt/decrypt: string|Promise<string>`; keep store method names and existing now parameters, add optional guard as last parameter: add(input,now?,valid?), complete(id,now?,valid?), snooze(id,dueAt,now?,valid?), remove(id,valid?), claim(id,now?,valid?), releaseClaim(id,expectedNotifiedAt,valid?). Service options add `currentEpoch():number`; handle(action,data) requires data.lockVersion equals this epoch and forwards guard into mutation. Native notification click supplies current epoch. Scheduler cancellation uses delivery epoch/canNotify; stale durable claim release remains compare-and-clear.

- [x] Add RED assertion tests for multiline/CRLF/tab normalization, async codecs, stale queued mutation (including switch-back) and store/claim publication cancellation. Confirm existing claim ABA/corruption/limits tests remain meaningful.
- [x] Implement minimal fixes with bounded persistence and final guard+atomic publication; avoid modifying shared SettingsWriter for other features. Cancelled operation must not mark healthy store corrupt.
- [x] Complete service native-alert invalidation/delivery/quit behavior and targeted GREEN; record exact test commands/results. Root commits after review; no worker git mutations.

### Task 3: Finish modal and custom reschedule

**Files:** `src/renderer/reminders.ts`, reminder-only sections of `index.html`/`shell.css`; optional `scripts/reminders-ui-check.mjs` (dedicated agent).
**Interfaces:** existing `createReminderUI({getState})` with open/reset/isOpen/sync. Every add/open/snooze/complete/remove/surface includes captured lockVersion. Custom **Đổi giờ** uses snooze with selected dueAt, preserving note/account and validating local date≤366days.

- [x] Observe RED for missing custom reschedule and identical-snapshot DOM writes; add usable chosen-date editor with save/cancel and keyboard focus.
- [x] Preserve multiline text safely, consistent note limit, correct quick times and pending/done filters. Invalidate drafts/editor/cache on workspace lock; reject late results without reopening modal.
- [x] Run headless light/dark 940/1280/400 px QA with hostile text, long note/error, archived/unavailable states and genuine change vs unchanged snapshots. Preserve unrelated shelf UI. Record screenshots/evidence; no worker git mutations.

### Task 4: Finish Electron acceptance (dedicated agent)

**Files:** `scripts/reminders-check.mjs`, `scripts/native-tabs-check.mjs`, `scripts/shelf-check.mjs` and optional fixture helpers only. The two existing fixture changes were authorized after final regression diagnosis; product source stayed frozen.
**Interfaces:** current bridge and currentEpoch requirements above; tests inject default current lockVersion unless a stale epoch is explicitly supplied. Adapt old filesystem/crypto hooks to real new store boundaries, never bypass product behavior.

- [x] Complete pending claim/privacy write race, archived-account and corrupt-store groups; add custom reschedule persistence, note newline, stale action switch-back, pause and source 0.8.1 shelf/floating coexistence.
- [x] Run only isolated temp profiles, fake protocols, native notification/safeStorage boundaries. Do not touch OS clipboard, real reminders, user sessions or send messages. GUI fixtures sequential, coordinate root slot.
- [x] Full reminder smoke and clean quit; report limits. Main/root final typecheck+wholeunit/build and private/floating/shelf/native suites affected; independent review, fix material findings, repeat affected checks.

### Task 5: Deliver development feature (root)

- [x] Write `docs/reply-reminders.md` and verification evidence, update existing WIP plan/spec status without rewriting historical results.
- [x] Final independent source review, commit complete code/docs on this feature branch; leave release/install for explicit next request.

## Execution ledger

- Base cb84830 is released0.8.1 main; original WIP 20aebfb preserved. Original WIP 198 tests/9 smoke groups are historical, not completion evidence.
- Ruling: user explicitly resumed the existing approved design; execute without another design/plan approval round.
- Ruling: use feature branch in shared checkout, preserving four unrelated untracked docs. No worktree relocation needed.
- Ruling: separate store/service, renderer and fixture ownership can proceed in parallel per active developer instruction; only root stages/commits shared git index.

## Completion evidence

- Typecheck and source build: pass. Full unit suite: 248 passed, zero failed/skipped; core targeted suite: 35 passed.
- Final isolated Electron groups: reminders 15, native tabs 16 (9 pages/drafts preserved), private space 17, floating chat 12, shelf 10. UI light/dark 1280/940/400 and unchanged-snapshot checks pass.
- Independent source review identified one capacity P2; guarded encrypted capacity projection and three RED→GREEN tests address it. Scoped rereview cleared it. Final fixture review found no important issues.
- Fixture-only final adjustments: wait for observed native hide before reading an epoch; use actual visible last tab for responsive wrap/End; wait for finished startup/foreground before shelf export. No failed mutation is automatically retried and existing privacy/cancellation assertions remain strict.
- User guide: `docs/reply-reminders.md`; durable verification record: `docs/verification-reply-reminders.md`. Detailed review reports and synthetic logs retained under ignored `outputs/reply-reminders-review/` for the final source commit.
- Delivery is a local source commit on `codex/complete-reply-reminders`. No merge/push, version bump, installer, release, install or change to the published 0.8.1 assets in this task. Keep the feature branch and shared checkout for subsequent work.
