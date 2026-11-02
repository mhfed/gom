# Tab Hibernation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release memory held by inactive chat views after 15 minutes and restore the same account session when selected again.

**Architecture:** Track background start times by account ID in the main process. On each existing poll, hibernate only eligible views after flushing their persistent session; activation recreates the view through the existing registry and partition. Keep the last unread snapshot and expose a sleeping status with clear settings copy.

**Tech Stack:** TypeScript, Electron WebContentsView, existing ViewRegistry and renderer state.

**Spec:** docs/superpowers/specs/2026-11-02-ram-saving-design.md — approved by the user.

## Global Constraints

- Sleep an inactive account view after exactly 15 minutes; reset the timer when it becomes active again.
- Never sleep the selected account while its provider tab is open, a floated or popup account, or an account during account/import operations.
- Flush storage and cookies before destroying a view; never clear the persistent partition.
- Preserve account tabs and the last unread count while asleep; wake using the same account ID, partition and provider URL.
- Invalidate old timers across workspace generation, account archive/removal and provider-tab closure.
- Make clear that sleeping tabs do not receive website notifications and unsaved drafts may be lost.
- No tests, typecheck or build commands in this session.

## Review Focus

- A workspace switch during session flush must keep the view alive and invalidate the old timer.
- A failed storage or cookie flush must leave the view attached to the registry and eligible for a later retry.
- A sleeping tab must retain its account and unread count, then create exactly one view on wake.
- Floating windows and provider popups must keep their backing account view alive.
- Archive/provider-close flows must clear timers for removed views; retained built-in views continue their background countdown.

---

### Task 1: Main-process hibernation lifecycle

**Files:** src/main/main.ts (reuse the existing registry and flush helper from src/main/view-registry.ts).

**Interfaces:** Preserve ViewRegistry.activate(id), peek(id) and remove(id). Use privacyGeneration, accessible(id), backgroundWarmups, floating, and popupProviders as existing guards.

- [x] Track inactive time and in-flight hibernation by AccountId; set/reset timestamps in createView, activate, workspace changes, provider close and account archive.
- [x] Add a 15-minute poll-driven hibernation path that rechecks account/workspace/view identity and operation generations before and after flushBeforeClose.
- [x] On successful flush, detach and destroy only that view, invalidate stale detection work, stop its warmup timer, retain the account tab and unread snapshot, and mark it sleeping.
- [x] On flush failure or a changed workspace/activity guard, leave the view alive and reset its retry timing; await in-flight work before app shutdown flush.
- [x] Ensure the existing activation and startup paths recreate sleeping views through the same registry and partition without duplicates.

### Task 2: Sleeping state and user-facing behavior

**Files:** src/shared.ts, src/renderer/shell.ts, src/renderer/index.html.

**Interfaces:** Add sleeping to ProviderStatus; preserve all existing AppState and account-selection interfaces.

- [x] Render a “Đang ngủ” account status and preserve stale unread data during wake loading until login detection settles.
- [x] Add a concise settings note stating the 15-minute sleep policy, notification limitation, unread refresh behavior and unsaved-draft risk.
- [x] Keep ordinary active status, connected-account counts and existing settings/account flows unchanged.

### Task 3: Source review and handoff

**Files:** docs/superpowers/specs/2026-11-02-ram-saving-design.md, docs/superpowers/plans/2026-11-02-ram-saving.md.

- [x] Mark the approved design as implemented and update the plan ledger with changed behavior and the verification restriction.
- [x] Review the diff for session clearing, stale callbacks, duplicate views, user-facing copy and unrelated changes; do not run tests, typecheck or build.

## Execution notes

- Implement in the existing checkout and preserve unrelated user changes. A later user instruction authorizes a source branch commit and push for review; packaging and release remain out of scope.
- The user approved this scope with “làm đi”; proceed directly without another approval round.
- Tests, typecheck and build were not run or added under the active session instruction.
- Ruling: a provider-closed account is no longer active even if state.active still holds its last ID — the retained view can sleep after 15 minutes — cost if wrong: site notifications stop, which is disclosed in Settings.

## Completion ledger

- Task 1: implemented — 15-minute account-scoped hibernation, session flush, workspace/operation revalidation, same-partition wake and shutdown coordination.
- Task 2: implemented — sleeping status, retained unread snapshot during wake, and settings copy about notifications and unsaved drafts.
- Task 3: independent source review found two important issues; retained unread data is no longer normalized as a raw snapshot, and recovery deadlines are filtered before consumption. Both fixes were source-inspected. No runtime or build verification is claimed.
- Final review: one independent read-only review; reviewer marked the first pass not ready, and the two important findings were corrected. No tests or second review were run under the active session instruction.
