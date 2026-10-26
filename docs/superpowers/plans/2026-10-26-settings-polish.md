# Gom settings polish implementation plan

**Goal:** Improve the shell and all Settings sections, fixing layout and navigation defects.

**Architecture:** Keep the vanilla TypeScript renderer and Electron bridge. Reorganize existing settings markup into a category rail and content column; retain native page bounds and all control IDs.

**Spec:** `docs/superpowers/specs/2026-10-26-settings-polish-design.md`

## Tasks

- [x] Capture the existing UI in an isolated Electron fixture; reproduce hidden connection statuses, long-label overflow, and section scroll behavior (`scripts/settings-ui-check.mjs`).
- [x] Rebuild the settings layout, grouped controls, theme previews, and dialog presentation (`src/renderer/index.html`, `shell.css`). Preserve Gom colors and 64px toolbar.
- [x] Add section headings, roving tab focus, scroll reset, account status placement, and usable menu labels (`src/renderer/shell.ts`).
- [x] Run build, typecheck, unit tests, settings fixture, and existing native shell/update checks. Inspect screenshots in both themes and review the final diff.

## Review focus

Long account/profile labels must not push controls out of view; connection status remains visible at 940px; tab changes start at the content heading; keyboard navigation and focus survive updates; settings never obscure a native view while leaving it interactive.

## Verification completed

- Build and TypeScript checks pass. All 128 unit tests pass.
- Settings fixture: 36 layout cases across three sizes and two themes, plus 10 behavior checks; zero overflow or renderer errors.
- Existing native-tabs suite: 12 checks, preserving four native pages and drafts. Command-focus checks pass. Manual-update integration: 9 checks pass.
- Renderer performance check passes using the installed Chrome executable via `TIN_NHAN_CHROMIUM`; unchanged state performs no DOM writes.
- Electron suites run sequentially because concurrent fixture windows compete for keyboard focus. An initial concurrent run timed out; the isolated sequential run passed.
- Screenshots reviewed in `outputs/settings-ui`; all test accounts and Chrome profiles are synthetic.
