# WhatsApp Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add WhatsApp Web as a built-in Gom provider with isolated accounts, official device linking, conservative status detection and unread counts.

**Architecture:** Extend the existing provider registry and reuse account/session/view infrastructure. Add a scoped WhatsApp branch to DOM collectors; unknown states remain unknown. Reuse the shell's catalog, tabs and account forms and show device-linking guidance instead of importing Chrome sessions.

**Tech Stack:** TypeScript, Electron, Node test runner, linkedom, existing Electron fixture harnesses.

**Spec:** `docs/superpowers/specs/2026-11-02-whatsapp-web-design.md` — approved by the user with “chốt”.

## Global Constraints

- Official entry `https://web.whatsapp.com/`, exact HTTPS navigation host `web.whatsapp.com`, ID `whatsapp`, accent `#25D366`.
- Append provider order; preserve saved account IDs, partitions, tabs and pins.
- Use a local WhatsApp logo consistently through the existing shared renderer.
- No Chrome session import, Business API, automatic sending, installer or release.
- Do not inspect or record message content or authentication data. Unknown unread counts display **—**.

## Review Focus

- Old catalogs must gain WhatsApp without moving existing account partitions or saved tabs.
- A QR screen, syncing page or expired session must not be treated as authenticated.
- Login instructions mentioned in a chat must not override actual signed-in controls.
- An unrelated unread marker or phone number must not become a WhatsApp count.
- Import controls must react when the selected destination account changes, even when no Chrome profile exists.

### Task 1: Provider, accounts and local logo

**Files:** `src/shared.ts`, `src/main/local-accounts.ts`, `src/renderer/shell.ts`, `src/renderer/logos/whatsapp.svg`, `src/renderer/logos/SOURCES.md`, `tests/whatsapp.test.ts`.

**Interfaces:** Extend `BuiltinProviderId`, `PROVIDER_ORDER`, `PROVIDERS` and Chrome import metadata with `whatsapp`; retain `defaultProviders()`, `validateCatalog()`, `accountPartition()` and `navigationPolicy()` signatures.

- [x] Add tests for built-in availability, exact navigation scope, old-catalog migration, independent partitions, saved tab order and unsupported Chrome import.
- [x] Run `node --test --experimental-strip-types tests/whatsapp.test.ts`; observe missing-provider failures.
- [x] Add registry metadata, empty Chrome auth-cookie metadata and local logo, without changing existing IDs/order.
- [x] Re-run the focused tests; expect PASS.

### Task 2: Status and unread collectors

**Files:** `src/main/auth-detection.ts`, `src/main/unread-snapshot.ts`, `tests/whatsapp.test.ts`.

**Interfaces:** Existing `authScript` and `unreadScript` strings execute inside the remote page and return existing status/sample types.

- [x] Inspect public WhatsApp Web login DOM and record supported evidence; do not claim a signed-in live test without user linking.
- [x] Add fixtures for visible device linking, confirmed signed-in controls including an empty list, hidden/ambiguous controls, sync/error states, title counters and unrelated chat text/markers.
- [x] Run the focused tests and observe failures before changing collectors.
- [x] Implement exact-host WhatsApp branches with conservative fallbacks and no body-text scans.
- [x] Re-run collectors and existing auth/sidebar tests; expect PASS.

### Task 3: Import guidance and integration verification

**Files:** `src/renderer/shell.ts`, `src/renderer/index.html`, a small shared import-guidance helper if needed, `src/main/main.ts`, `tests/whatsapp.test.ts`, `scripts/whatsapp-check.mjs`, `docs/verification-whatsapp-web.md`.

**Interfaces:** Preserve `DesktopBridge.importSession(sourceId, accountId)`; reject WhatsApp before importing cookies. Derive selected-account guidance and disabled state in a testable helper used by the renderer.

- [x] Add failing tests for WhatsApp guidance with/without profiles, normal-provider behavior and target changes.
- [x] Implement the hint and disabled import button; make the destination selector update guidance immediately. Update static explanatory copy and the main-process unsupported-import response.
- [x] Run `npm run typecheck`, `npm test` and a temporary-profile Electron fixture for catalog search, logo, linking/connected statuses, two sessions, tab/view reuse, restart persistence and import controls; record results.
- [x] Inspect fixture screenshots. Record any real-site checks separately from fixture checks.
- [x] Review the final diff and report remaining live-linking limits. Do not package, publish or modify unrelated work.

## Execution notes

- Implementation runs directly in the supplied checkout on `codex/timed-focus`; unrelated README/website changes stay untouched. The user later authorized pushing this feature branch for review; packaging and release remain out of scope.
- The user's approval authorizes implementation; no additional plan-approval round is needed.
- Task progress and verification evidence are recorded below and in the verification document.

## Completion ledger

- Task 1: complete — provider/account tests RED→GREEN; local logo verified in Electron.
- Task 2: complete — auth/unread tests RED→GREEN; public login DOM observed; signed-in live validation remains explicitly unverified.
- Task 3: complete — import guidance tests RED→GREEN; isolated Electron fixture PASS, typecheck/build PASS, final suite 266/266 PASS.
- Final review: one independent read-only review; catalog capacity finding reproduced RED→GREEN and fixed; no deferred minor findings.
- Ruling: count built-in default accounts separately from the legacy 104-account capacity — preserves every previously accepted account list and makes migration repeatable; modestly increases the accepted total catalog size.
- Live-account limitations accepted as verification limits, not success claims; detailed evidence in `docs/verification-whatsapp-web.md`.
