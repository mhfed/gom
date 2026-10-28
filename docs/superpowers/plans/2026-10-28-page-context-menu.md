# Provider Page Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a context-sensitive native right-click menu and image-aware `⌘C` behavior to embedded provider pages.

**Architecture:** Attach context-menu and keyboard handlers through the existing `guard(contents, id)` function. Build native Electron menu items from `ContextMenuParams`; for `⌘C`, distinguish a hovered image from text using a read-only page query, then copy through the same `WebContents`.

**Tech Stack:** Electron 45, TypeScript, native `Menu`, existing `clipboard` and session download handling.

**Spec:** `docs/superpowers/specs/2026-10-28-page-context-menu-design.md`

## Global Constraints

- Add no dependency.
- Do not inject JavaScript into provider pages.
- Do not change app-wide Edit menu shortcuts or provider-tab menus.
- Preserve `⌘C` for text selection and editable fields; copy a hovered image only when there is no text to copy.
- Preserve each provider's session and existing download dialog behavior.
- This turn is source-only; ask before building, installing, or releasing.
- Do not add or run automated tests unless the user asks.

## Review Focus

- Image with contents: Copy Image uses the clicked page coordinates and Save Image uses the page session.
- Image inside a link: both image and link actions remain available.
- `⌘C` over a loaded image with no text selection copies the image; `⌘C` with selected text keeps normal copy behavior.
- Text selection versus editable field: Copy acts on the selected text; Cut/Paste are shown only for editable content.
- Owned popup: actions apply to the popup that opened the menu, not the parent page.
- Destroyed or closing `WebContents`: menu callbacks do nothing.

---

### Task 1: Add the provider page context menu

**Files:**
- Modify: `src/main/main.ts` in `guard(contents, id)`.

**Interfaces:**
- Consumes Electron `ContextMenuParams`, `Menu`, `BrowserWindow.fromWebContents`, and the existing `clipboard` import.
- Uses the existing `guard()` registration for provider page and owned popup `WebContents`.

- [x] Add one `context-menu` listener in `guard()` and prevent the unhandled page menu.
- [x] Construct menu items conditionally: `copy` for selection/editable fields; `cut`, `paste`, and `selectAll` for editable fields; `copyImageAt(x, y)`, copy image address, and `downloadURL(srcURL)` for image content; copy link address for links.
- [x] Open the menu against `BrowserWindow.fromWebContents(contents)` and make callbacks no-op when the contents are destroyed or Gom is closing.
- [x] Run `npm run typecheck`; do not build or publish in this task.

### Task 2: Copy a hovered image with `⌘C`

**Files:**
- Modify: `src/main/main.ts` in `guard(contents, id)`.

**Interfaces:**
- Consumes Electron `before-input-event`, `WebContents.executeJavaScript`, `WebContents.copyImageAt`, and `WebContents.copy`.
- Reuses the existing provider-page ownership and lifecycle checks.

- [x] Intercept only an unmodified `⌘C`/`Ctrl+C` key-down in provider content, so Electron does not run the Edit-menu accelerator first.
- [x] Run a read-only query in the page: prioritize selected text or a selected editable-field range; otherwise return a visible, loaded `img:hover` rectangle; leave other cases to normal `WebContents.copy()`.
- [x] Copy the hovered image with `copyImageAt()` using a point inside the visible rectangle; keep text copying through `copy()` and ignore destroyed/closing contents.
- [x] Run `npm run typecheck`; do not build or publish in this task.
