# Named Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add named, persistent navigation layouts that the user can save, switch and delete independently in normal and private spaces.

**Architecture:** Keep existing normal/private navigation as the default layout. Store up to 12 named `WorkspaceNavigation` snapshots per privacy zone in `window.json`, expose only the active zone's names through AppState, and add a small toolbar picker backed by main-process IPC.

**Spec:** `docs/superpowers/specs/2026-11-02-named-workspaces-design.md`.

## Global Constraints

- Preserve normal/private account membership and lock boundaries.
- Never return private workspace names/navigation while the private space is locked.
- Existing `window.json` workspaces remain the default during migration.
- Do not add or run tests, typecheck or build in this session.

### Task 1: Persist isolated named navigation layouts

**Files:** `src/main/main.ts`, `src/shared.ts`, `src/main/preload.ts`.

- [x] Add strict bounded normalization for persisted named layouts and active IDs.
- [x] Save/restore the selected layout while retaining a default layout in each privacy zone.
- [x] Add guarded main-process commands for save, switch and delete; persist every successful change.
- [x] Include only the current zone's profile summaries in AppState.

### Task 2: Add workspace picker UI

**Files:** `src/renderer/index.html`, `src/renderer/shell.ts`, `src/renderer/shell.css`, new `src/renderer/workspace-presets.ts`.

- [x] Add a picker, save dialog and delete confirmation.
- [x] Explain that a named workspace stores tabs/account selection and not account credentials.
- [x] Reset open dialogs on privacy-zone changes.

### Task 3: Review behavior and record limitations

- [x] Review migration, account normalization, private projection, profile switching and saving.
- [x] Record that these are local navigation layouts and do not synchronize accounts or sessions.

## Execution Notes

- User selected “Không gian làm việc” and authorized sequential implementation.
- Preserve unrelated in-progress repository changes. A later user instruction authorizes a source branch commit and push for review; packaging and release remain out of scope.
- Source review found and fixed stale private IPC requests, persistence reporting, private-label cleanup, reserved default naming, and feedback placement beneath a native view. No runtime verification is claimed.

## Completion Ledger

- Task 1: implemented — default plus up to 12 locally stored named layouts per privacy zone, persisted with migration-safe normalization and lock-version guarded IPC.
- Task 2: implemented — toolbar picker, save dialog, delete confirmation and zone-change scrubbing.
- Task 3: independent read-only review complete; no actionable findings remain. No tests, typecheck or build were run.
