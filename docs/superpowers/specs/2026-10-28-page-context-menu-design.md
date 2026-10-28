# Provider page context menu

## Intent

Make right-click useful inside Gom's embedded provider pages, especially for copying and saving images. The current app has a context menu for Gom's own provider tabs, but `guard()` does not add one to provider page `WebContents`; the macOS Edit menu only covers normal editing commands.

## Scope

- Add a native Electron context menu to the embedded provider pages and their owned popups.
- Show **Copy**, **Copy Image**, **Copy Image Address**, **Save Image**, and **Copy Link Address** only when the clicked content supports those actions.
- Keep cut, paste, select all, and copy for editable fields and selected text.
- Make `⌘C` copy a hovered, loaded image when there is no text selection or active text field; preserve normal text copying in all other cases.
- Save images through the page's existing session so Electron's current download dialog behavior applies.
- Preserve the existing app-wide Edit menu and keyboard shortcuts. Handle the copy shortcut in the provider `WebContents` before Electron's Edit-menu accelerator, then invoke its normal copy command when the page has text to copy.
- Keep provider-tab context menus unchanged.

## Approaches

1. **Native Electron context menu plus a focused keyboard handler — selected.** Use `WebContents`'s `context-menu` event and native `Menu` items. For `⌘C`, intercept the shortcut in `before-input-event`, make a read-only query for a hovered image or text selection, and copy through the existing `WebContents` editing APIs. This works without persistent provider-page scripts or new dependencies.
2. **Inject a JavaScript menu into each website.** Rejected because it duplicates behavior across pages and can break with site DOM changes or shadow roots.
3. **Keep the current behavior.** Rejected because the missing image actions remain unavailable.

## Constraints and calls

- Use the Electron APIs already installed in the project; add no dependency.
- Attach handling through the existing `guard(contents, id)` path, which already owns provider pages and popups.
- Do not add navigation actions that bypass `navigationPolicy` or the app's external-link confirmation.
- Do not change session storage, page contents, or the app-wide Edit menu definition; handle the copy shortcut only in guarded provider `WebContents`.
- If a loaded `<img>` is under the pointer with no selected text or focused text field, `⌘C` copies that image; otherwise use the page's normal copy command.
- This is a source change only. Ask before building, installing, or releasing a package.

## Verification

- Run the TypeScript typecheck.
- When a package is later approved, manually check right-click on selected text, an image, a link, and an editable field in a provider page and an owned popup.
- Do not add or run automated tests unless the user asks.
