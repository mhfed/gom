# Separate Spaces Implementation Plan

> **For agentic workers:** Use the existing parallel implementation workflow. Root owns main-process orchestration; agents own isolated projection/navigation and renderer changes.

**Goal:** Make entering the password-gated private space switch to its own accounts, tabs and navigation.

**Architecture:** Retain account IDs and Chromium partitions; `privateUnlocked` selects the active workspace exclusively. Save independent navigation snapshots and project only the active workspace across IPC.

**Tech Stack:** Electron, TypeScript, node:test, isolated Playwright Electron fixtures.

**Spec:** `docs/superpowers/specs/2026-10-28-separate-spaces-design.md`

## Global Constraints

Preserve existing sessions and passwords; never use personal profiles in testing. Normal accounts remain normal during migration. Private account notifications stay disabled. Restart locked. Do not touch unrelated untracked design files.

## Review Focus

- Empty private workspace exposes no normal tabs/accounts.
- Same-provider accounts in different spaces retain distinct partitions and drafts.
- Lock during asynchronous creation cannot publish or activate an account in the wrong space.
- Switching cancels stale dialogs/menus and hides/mutes inactive native views/popups.
- Persist/restart restores independent navigation without exposing private records.

### Task 1: Projection and navigation model

- [x] Write failing unit tests for exclusive snapshots and empty-space defaults.
- [x] Implement `private-state.ts` filtering in both directions and `workspace-state.ts` navigation normalization/migration with tests.
- [x] Run targeted unit tests.

### Task 2: Main-process transition and ownership

- [x] Add an isolated failing Electron scenario reproducing setup showing normal accounts.
- [x] Update accessibility, enter/lock transitions, persisted navigation, account/site creation, transfer and native view handling in `main.ts`.
- [x] Verify separate accounts, tabs, drafts, IPC denial and restart in fixture.

### Task 3: Renderer clarity

- [x] Show active space, private empty state and exit action; avoid account settings modal replacing the saved workspace navigation.
- [x] Preserve password-verified transfer behavior and clear transient UI across switches.
- [x] Update isolated renderer checks for the new semantics.

### Task 4: Verify and deliver correction

- [x] Run typecheck, complete unit suite, build and isolated Electron/UI smoke checks.
- [x] Independent review focused on isolation and asynchronous transitions; fix findings.
- [x] Package/release corrected version and install validated Mac app under the existing release/install authorization.
