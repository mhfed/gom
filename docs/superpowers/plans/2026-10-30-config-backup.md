# Configuration Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement inline; one independent whole-branch review at the end.

**Goal:** Export ordinary-workspace configuration and restore it through a reviewed merge and safe restart.
**Architecture:** Strict portable document/projector; queued startup restore with journaled metadata transaction; main-owned dialogs and epoch-bound preview; existing Gom settings UI.
**Tech Stack:** Existing Electron/TypeScript/CSS, Node fs/crypto, node:test and Playwright. No new dependencies.
**Spec:** docs/superpowers/specs/2026-10-30-config-backup-design.md

## Global Constraints

- `gom-config` version 1; 8 MiB document cap; 104 accounts, 100 custom providers, 32 KiB/64×64 PNG.
- Ordinary workspace only. No sessions, verifier, private metadata, content, reminders, shelf, Focus session, machine bounds or sleep choice exported.
- Merge retains extra accounts; private ID/provider URL conflicts abort. Preview before change, protection backup before pending, restart before applying.
- Startup journal recovery precedes catalog reads. Native dialogs/paths stay in main. Existing isolated managed worktree reused.
- User explicitly delegated scope and execution; no further design approval needed. Keep source locally; no publishing/install.

## Review Focus

1. Invalid/malicious logo or unknown fields must never become paths/code or leak into export — Task 1 invalid-document tests.
2. Backup IDs colliding with hidden accounts must preserve membership and not reveal identity — Tasks 1/3 collision tests.
3. App closes/locks or config changes during file dialog/write — Task 3 stale-token and Task 2 guarded-queue tests.
4. Crash/partial multi-file publish must recover old coherent config before startup — Task 2 real-file rollback tests.
5. Existing private navigation, extra accounts, Focus and partitions survive merge — Tasks 1/3 retention/restart tests.

### Task 1: Portable model and merge

Files: `src/backup-types.ts`, `src/main/config-backup.ts`, reuse PNG validator from `src/main/provider-logos.ts`; `tests/config-backup.test.ts`.
Interfaces: `ConfigurationSource` (accounts/providers/navigation/preferences/logos), `createConfigurationBackup(source, now)`, `parseConfigurationBackup(text)`, `mergeConfigurationBackup(source, backup)`; validated document + summary via shared types.
- [ ] Write real roundtrip/privacy, malformed/version/size, PNG, conflicts and retention tests; observe missing module RED.
- [ ] Implement whitelist export, strict input/references, bounded PNG and safe merge; targeted tests GREEN.
- [ ] Commit portable model and tests.

### Task 2: Durable startup restore

Files: `src/main/config-restore.ts`, `tests/config-restore.test.ts`.
Interfaces: `ConfigurationRestore(root).queue(document, protection, valid)`, `.startup():Promise<string>`; `ConfigurationTransaction(root).commit(files)` and `.recover()`. Disk data/paths do not cross renderer.
- [ ] Write real temp-directory tests for pending/protection, canceled or failed writes, partial publication rollback, crash journal, private-field retention and invalid pending; observe RED.
- [ ] Implement stage/journal/synchronous publication, bounded recovery and startup merge before app reads; targeted tests GREEN.
- [ ] Commit durable restore and tests.

### Task 3: UI, guarded IPC and integration

Files: `src/main/main.ts`, `src/main/preload.ts`, `src/shared.ts`, `src/renderer/backup.ts`, `src/renderer/shell.ts`, `src/renderer/command.ts`, `src/renderer/index.html`, `src/renderer/shell.css`, `scripts/backup-check.mjs`, README and user/verification docs.
Interfaces: `DesktopBridge.backup(action: export|preview|restore|cancel|folder, {lockVersion,token?}) -> BackupResult`; main stores preview token/document/fingerprint, UI resets on workspace epoch changes.
- [ ] Write isolated Electron fixture first; observe missing bridge RED.
- [ ] Wire main dialogs, preview, protection backup, queue, restart and pre-catalog recovery. Add settings section, scope card, preview, accessible actions and inline results with existing styles/icons.
- [ ] Verify fixture export/preview/cancel/restart/retention/private/stale/failure/layout. Typecheck/build/full unit suite/format/diff checks; record legacy native harness limits from Resource verification.
- [ ] One fresh read-only whole-branch reviewer; fix Important/Critical via RED→GREEN, ledger minors/rulings. No per-task subagents.
- [ ] Save final source commit, preserve worktree. Deliver concise result with screenshot and evidence.
