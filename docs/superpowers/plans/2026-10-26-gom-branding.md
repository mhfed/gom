# Gom Branding Implementation Plan

> **For agentic workers:** Execute the approved branding in this session; use independent subtasks with disjoint file ownership and review the integrated result.

**Goal:** Ship a local Gom 0.6.0 installer matching the approved name, logo and palette while retaining existing account data.

**Architecture:** Keep the Electron shell and provider views intact. Change visible identity and generated vector icons; preserve persisted identities and macOS encryption compatibility. Extend the update artifact recognizer without changing its trusted source.

**Tech Stack:** Electron 45, TypeScript, CSS, SVG, sharp, Electron Forge.

**Spec:** `docs/superpowers/specs/2026-10-26-gom-branding-design.md`.

## Global Constraints

- Preserve existing uncommitted work, session partitions, userData and bundle ID.
- Main color values: `#0B7A75`, `#9DE4CF`, `#F7F7F2`, `#172E2C`.
- No new dependencies; no personal session or message access during verification.
- Use existing fixture tests; add regression tests only for updater behavior.

## Review Focus

- Renaming must retain the macOS Keychain encryption identity, not just the userData folder.
- Both historical and new names must pass the updater's strict version/architecture/URL checks.
- Packaged runtime must include the new settings mark and Dock/menu-bar assets.
- Light/dark/automatic modes must remain readable without changing platform content.
- New installer documentation must explain the different app filename during upgrade.

## Tasks

- [x] Rebuild approved logo as SVG; generate iconset/ICNS and tray icon from the same mark. Update build packaging allowlist.
- [x] Apply renderer name and palette, verify contrast and retained layout.
- [x] Add failing Gom updater recognition tests, implement both new/legacy name support, verify targeted suite.
- [x] Confirm encryption identity preservation, update app/product names and version, retain persisted IDs.
- [x] Run typecheck/unit/build, isolated native shell/update/persistence checks, inspect screenshots and fresh code review.
- [x] Package DMG/ZIP; verify signatures, versions, runtime inventory, integrity/checksums. Update release and installation docs.

## Progress

Implementation authorized by the user's “TRiển khai cho toi” after the concrete visual proposal. No additional design approval is needed.

Completed 2026-10-26. Evidence: `docs/release-0.6.0.md`, `outputs/Gom-0.6.0/`, and `outputs/SHA256SUMS-Gom-0.6.0.txt`. All installer checks passed. Existing working-copy changes were preserved.
