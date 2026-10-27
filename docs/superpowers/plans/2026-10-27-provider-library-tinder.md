# Provider library and Tinder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the provider library easier to scan with grouped compact cards and add Tinder as a built-in web provider.

**Architecture:** Extend the built-in provider registry for Tinder, reusing the navigation policy’s exact-host checks and restricted Google sign-in path. Render the provider catalog as responsive grouped cards while keeping the current search, pin, open-status, separate session, and custom-website flows.

**Tech Stack:** TypeScript, Electron, HTML, CSS, existing provider registry and session model.

**Spec:** `docs/superpowers/specs/2026-10-27-provider-library-tinder-design.md`

## Global Constraints

- Keep the existing cream/teal light palette and dark-theme tokens.
- Group built-in communication providers under “Giao tiếp”, Tinder under “Hẹn hò”, and user-created providers under “Website riêng”.
- Preserve search, result count, open status, pin/unpin, keyboard focus, and the custom-website form.
- Use Tinder’s official desktop site and a separate persistent Gom session. Add a one-time Chrome DevTools handoff for Tinder’s browser-storage credentials; do not add Tinder unread-count support.
- Do not add Bumble until Bumble Web is available again.
- Tinder Chrome import must be user-initiated, limited to Tinder auth fields, loopback-only, short-lived, and rollback on failed verification. Never scan all Chrome storage or forward credentials to a remote endpoint.
- Do not build, install, or publish a package without asking the user first.

## Review Focus

- Each existing provider and each custom website appears once in its intended group; Tinder appears in “Hẹn hò”.
- Search updates the visible count and hides empty groups without losing keyboard focus.
- Pin/unpin and open-status controls remain attached to the correct provider card.
- Narrow layouts reflow cards without horizontal overflow.
- Tinder login redirects stay within its trusted hosts and explicitly supported sign-in pages; unrelated origins remain external or blocked.

---

### Task 1: Register Tinder as a built-in provider

**Files:**
- Modify: `src/shared.ts`
- Modify: `src/main/local-accounts.ts`
- Modify: `src/main/main.ts`
- Modify: `forge.config.cjs`
- Modify: `src/renderer/shell.ts`
- Create: `src/renderer/logos/tinder.svg`
- Modify: `src/renderer/logos/SOURCES.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `BuiltinProviderId`, `PROVIDER_ORDER`, and `PROVIDERS` from `src/shared.ts`.
- Produces: `tinder` provider metadata used by account creation, provider navigation, and the library logo map.

- [x] Add `tinder` to the built-in provider ID and order; use `https://tinder.com/app/login` and exact official Tinder hosts.
- [x] Add empty Chrome-cookie import metadata for Tinder so existing typed provider maps continue to reject unsupported imports safely.
- [x] Allow Tinder’s first-party navigation and Google’s restricted sign-in path; keep unrelated origins external.
- [x] Ask before granting Tinder location access and include the macOS location usage description.
- [x] Add a local Tinder logo asset and record its source; document Tinder as unreleased source work without claiming Bumble support.
- [x] Run `npm run typecheck` and `git diff --check`; inspect the Tinder host allowlist and import metadata.

### Task 2: Render the provider library as grouped cards

**Files:**
- Modify: `src/renderer/provider-navigation.ts`
- Modify: `src/renderer/shell.css`
- Modify: `src/renderer/index.html` (use the already requested “bạn” form of address in this screen)

**Interfaces:**
- Consumes: the ordered `ProviderDefinition[]` from `AppState.providers` and the existing `select`, `logo`, `pinProvider`, and status behaviors.
- Produces: grouped card sections with the existing search, pin, open-status, count, and empty-state behavior.

- [x] Group built-in providers as “Giao tiếp” or “Hẹn hò”; group custom providers as “Website riêng”.
- [x] Render compact cards with a three-column wide layout and two-/one-column responsive breakpoints.
- [x] Keep search filtering, result count, focus restoration, open status, and pin controls working across all groups.
- [x] Review the responsive rules and DOM updates without running a build; leave visual packaging for after the user approves it.
- [x] Run `npm run typecheck` and `git diff --check`; inspect the diff for focus, count, and group-visibility logic.

### Task 3: Import Tinder's existing Chrome session

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/auth-detection.ts`
- Create: `src/main/tinder-chrome-bridge.ts`
- Modify: `src/renderer/index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: selected Chrome profile, the signed-in Tinder tab, and the Tinder account's isolated Gom partition.
- Produces: a one-time DevTools handoff, loopback-only transfer, scoped storage injection, and rollback if Tinder returns to login.

- [x] Read only Tinder's API token, device UUID, and MFA record from the active Tinder page; do not scan Chrome profile files.
- [x] Require exact Tinder origins, a random single-use route, loopback binding, a size limit, and a short timeout.
- [x] Preserve an existing Tinder target session and restore prior device ID if the new session fails validation.
- [x] Update UI and source documentation; run typecheck and diff checks without building.

## Execution Boundary

Implement the two tasks in this session. Do not run a package build or install the app until the user approves that separate step.
