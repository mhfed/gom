# Provider tabs Implementation Plan

> **For agentic workers:** Use the approved design and independent file ownership below. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement open/pinned provider tabs, overflow, and custom websites.
**Architecture:** Migrate the catalog atomically, expose dynamic provider definitions, and persist separate tab state. Main owns native views/menus and trusted IPC; renderer owns responsive tabs and the provider library.
**Tech Stack:** Electron 45, TypeScript, vanilla renderer DOM, Node tests, Playwright Electron fixtures.
**Spec:** `docs/superpowers/specs/2026-10-27-provider-tabs-design.md`

## Global Constraints

- Header remains 52px. Preserve account IDs, partition names, encryption identity, existing account pins and notification preferences.
- Native menus must work above service views; shell panels hide native views.
- Test with isolated HOME/mock keychain and local fixtures, never real profiles or messages.
- No dependency additions and no automatic release.

## Review Focus

- Legacy migration and corrupt primary/backup retain account identity and do not overwrite unknown state.
- Custom URLs and IPC cannot widen privileged access or bypass origin checks.
- Closing the active/last tab and notification activation keep state and visible view coherent.
- Long names, all pinned tabs, and minimum window width keep active and overflow controls accessible.
- Restart and close/reopen retain sessions; unopened custom providers do not start background views.

### Task 1: Catalog, provider contracts and origin policy
Files: `src/shared.ts`, `src/main/accounts.ts`, `src/main/providers.ts`, `src/main/security.ts`, `src/main/notification-policy.ts`, `tests/providers.test.ts`, `tests/accounts-multi.test.ts`.
- [x] Write and run failing tests for v1/v2 migration, atomic provider/account writes, invalid/dangling IDs, URL validation and exact-origin permissions.
- [x] Implement `ProviderDefinition`, dynamic `ProviderId`, full `AppState.providers`, `ProviderTabs`, provider bridge methods and catalog v2.
- [x] Run focused tests and typecheck; root resolves cross-task integration errors.

### Task 2: Responsive renderer and library
Files: `src/renderer/shell.ts`, `command.ts`, `index.html`, `shell.css`; optional focused renderer helper/test.
- [x] Add behavioral tests for fitting tabs with an always-visible active item and overflow.
- [x] Render dynamic open tabs, pins, close/context actions, plus/library and custom website form. Update settings, account editor and command palette for dynamic providers and fallback icons.
- [x] Check keyboard focus, minimum width, long names, light/dark states and periodic state updates without focus loss.

### Task 3: Main lifecycle and persistence
Files: `src/main/main.ts`, `preload.ts`, new `provider-tabs.ts`, `tests/provider-tabs.test.ts`.
- [x] Write/run failing pure-state tests for normalization, opening, pinning and closing active/last tabs.
- [x] Integrate provider registry, catalog mutation, native overflow/context menus and provider library panel. Reopen tabs through every activation path; skip messaging probes for custom sites.
- [x] Persist tab state and instantiate custom views only when needed. Close custom views safely while retaining session data.

### Task 4: Verification and review
Files: `scripts/provider-tabs-check.mjs`, relevant existing regression scripts, README.
- [x] Add isolated Electron scenario for custom site add/pin/overflow/close/reopen/restart and storage isolation.
- [x] Run typecheck, unit tests, build, new smoke and existing native-tabs/settings/multi-account checks sequentially.
- [x] Fresh code review, resolve material findings, update docs and record exact evidence.

## Execution notes

The user's implementation request supplies authorization to proceed after the approved interactive mock. Work continues on `codex/provider-tabs` in the clean current checkout, with disjoint agent ownership. No additional design approval is needed.

Completed evidence and limits are recorded in `docs/provider-tabs-2026-10-27.md`.
Final checks: 150 unit tests; 15 provider scenarios; native tabs, command focus,
Settings, and multi-account fixtures; typecheck, build, formatting and diff checks.
Review findings have failing-before/fixed-after regression coverage. GUI checks
ran sequentially with isolated profiles. No packaging or publishing was performed.
