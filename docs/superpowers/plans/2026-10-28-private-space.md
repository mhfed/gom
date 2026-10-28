# Gom Kín Implementation Plan

**Goal:** Password-gated accounts hidden from Gom while locked.
**Architecture:** Main-process authorization; private membership persisted in account catalog; independent password verifier; filtered renderer snapshots and native surfaces. Keep existing session partitions.
**Spec:** ../specs/2026-10-28-private-space-design.md
**Tech Stack:** Electron, TypeScript, Node crypto.

User said “Làm đi”: proceed with recommended app UI lock. No reset that reveals private accounts; forgotten password leaves them locked. No claim of session encryption. Work in the current workspace and preserve unrelated documents. No packaging/release.

- [x] Password store: `src/main/private-space.ts`, scrypt verifier, atomic persistence, cooldown, missing/corrupt config fails closed when private accounts exist; meaningful security tests.
- [x] Catalog and projection: persist optional Account.private; `src/main/private-state.ts` filters every account-indexed dictionary, custom provider and navigation metadata while locked. Tests for leaks and last private account.
- [x] UI: setup/unlock/change password dialog, private membership actions, lock button. Clear sensitive rendered content when locking; use existing theme.
- [x] Runtime: shared/preload IPC, authorization at all user entry points, startup filtering, native menus and badges, popup visibility/audio, notifications denied for private accounts (even unlocked to avoid OS history), hide/minimize/screen-lock transitions, generation guard for async unlock and account mutations.
- [x] Verify: typecheck, unit suite and targeted isolated Electron smoke; independent review and fix material findings. No personal profiles used.

Review focus: stale callbacks after lock; missing verifier; already-open popups; notification click bypass; private-only catalog; imported credentials or settings exposing IDs. Lock is a UI boundary; session files remain OS-user accessible.

## Execution record

- User instruction “Làm đi” authorized proceeding with the recommended UI lock; no additional approval loop. Password recovery that exposes private accounts was removed before implementation.
- Parallel implementation: verifier/catalog/projection and renderer; main integration handled in this chat. Independent review found all-private navigation fallback, ordinary hide/show regression, and outbound-membership rollback risk. Each was fixed; catalog protection was also narrowed to preserve recovery for users without private-space setup.
- Added a persistent membership journal to recover interrupted outbound changes as private before startup creates views. Native menus/dialogs are canceled on lock; pending unlock checks use a generation counter. Renderer uses lockVersion to scrub even while already locked.
- Confirmed two existing test failures and fixed their causes: escaped Tinder auth regex inside generated JavaScript; obsolete legacy provider expectation omitted Tinder.
- Validation: TypeScript and local compilation pass; 162 unit tests pass. Isolated Electron smoke passes 10 groups including drafts, IPC denial, popup hiding, restart, all-private navigation, ordinary hide/show and membership journal recovery. Synthetic renderer smoke passes password validation, cancellation, private DOM scrub, zero visible accounts and locked-to-locked password clearing.
- Runtime checks ran on macOS with fixture pages, temporary profiles and mock Keychain; Windows runtime and real-provider notifications have not been exercised. No installer, installation, tag or release was created. Work remains in the current workspace for review.
