# Provider Tab Logo Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user assign a bundled icon or local PNG/JPG image to a provider, restore its default, and show the same logo everywhere that provider appears.

**Architecture:** Store provider logo selection metadata in a dedicated `provider-logos.json` file under Electron `userData`; store normalized PNG files separately by validated provider ID. Expose the selection descriptor in `ProviderDefinition`, while a narrow preload API retrieves image data on demand so every AppState update does not carry image bytes. A renderer dialog handles the bundled-logo gallery and converts local PNG/JPG images to a centered 64×64 PNG before the main process validates and saves them.

**Tech Stack:** Electron IPC, TypeScript, Electron renderer HTML/CSS, Canvas image conversion, atomic JSON and PNG writes using Node.js.

**Spec:** `docs/superpowers/specs/2026-10-28-provider-logo-customization-design.md`

## Global Constraints

- Apply one logo to each provider ID, including built-in providers and custom websites.
- Show the chosen logo in provider tabs, provider library, account/provider cards, and every other view using the shared provider logo renderer.
- Persist the selection locally across restarts and app updates; do not sync between machines.
- The gallery uses bundled default provider logos. Local image input accepts PNG/JPG, center-crops, normalizes to 64×64 PNG, and does not fetch URLs or accept SVG.
- Restore clears the selected logo and returns to the built-in default logo or custom-provider initials.
- Do not alter provider URL, account identity, login partitions, cookies, unread counts, or application/Dock/taskbar icons.
- Do not add or run automated tests under the current instruction. Use typechecking, static checks, and diff review only.
- Do not build, package, create a tag, upload, or publish until the user explicitly approves a build.

## Files and Responsibilities

- `src/shared.ts`: add serializable provider-logo state and change-request unions; expose logo API methods on `DesktopBridge`.
- `src/main/provider-logos.ts`: validate versioned selection metadata, read/write `<userData>/provider-logos.json`, and atomically store bounded 64×64 PNGs as `<providerId>-<revision>.png` under `<userData>/provider-logos/` using safe provider IDs.
- `src/main/main.ts`: load logo descriptors after provider catalog load; add native context-menu action, image retrieval and selection IPC handlers; update providers and publish after a successful persisted change.
- `src/main/preload.ts`: expose the narrow provider-logo editor event, save/reset command, and on-demand image retrieval.
- `src/renderer/shell.ts`: render selected bundled logos or cached local images; wire the editor dialog and upload conversion; include provider logo revision in relevant render signatures.
- `src/renderer/provider-navigation.ts`: existing header and library render signatures already include provider definitions, so logo descriptors refresh those views without a navigation-specific change.
- `src/renderer/index.html`, `src/renderer/shell.css`: add an accessible dialog with gallery choices, local image picker, preview, error status, and restore-default action.

## Review Focus

- A corrupt or missing `provider-logos.json` must leave account/provider catalog data readable and use defaults for invalid logo entries.
- A PNG with a malformed header, oversized payload, mismatched dimensions, or unsupported MIME must be rejected without replacing the existing logo.
- Changing an image to another image for the same provider must invalidate cached renderer data and update every visible occurrence.
- Choosing a bundled icon or restoring the default must remove any prior local PNG for only that provider.
- A provider ID not present in the current catalog, including a malformed `web_` ID, must not read or write an arbitrary path.

---

### Task 1: Add local provider-logo storage and IPC contracts

**Files:**

- Modify: `src/shared.ts`
- Create: `src/main/provider-logo-store.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`

**Interfaces:**

- `ProviderLogoSelection` is either `{ kind: "builtin"; providerId: BuiltinProviderId }` or `{ kind: "image"; revision: number }`.
- `ProviderLogoChange` is either `{ kind: "builtin"; providerId: BuiltinProviderId }`, `{ kind: "image"; dataUrl: string }`, or `null` for reset.
- `ProviderDefinition.logo?: ProviderLogoSelection` identifies an override; absent selection means the current default.
- `DesktopBridge.getProviderLogo(providerId: ProviderId, revision: number): Promise<string | null>` returns an on-demand `data:image/png;base64,...` URL only when the stored image revision matches.
- `DesktopBridge.setProviderLogo(providerId: ProviderId, change: ProviderLogoChange): Promise<ProviderLogoResult>` stores a bundled icon, normalized PNG, or reset and returns the updated descriptor.
- `DesktopBridge.onProviderLogoEditor(callback: (providerId: ProviderId) => void): () => void` receives a request from the native tab menu.

- [x] Add the selection union and bridge signatures in `src/shared.ts`; preserve current serialized provider fields.
- [x] Implement `ProviderLogoStore` metadata version 1 at `<userData>/provider-logos.json`; load valid provider IDs only, ignore invalid entries, and keep provider catalog loading independent from logo-file errors.
- [x] Validate local PNG data URLs as canonical base64, enforce a 32 KiB decoded limit, verify PNG signature and 64×64 dimensions, and write each new revision to a temporary file before atomically renaming it; only then atomically update metadata and remove the prior image best-effort. Use filenames derived only from a validated built-in or custom provider ID and revision.
- [x] Add store operations to retrieve image data only for a matching revision, save the `{kind:"image", revision}` descriptor, select `{kind:"builtin", providerId}`, and reset. Increment image revision when replacing an image so renderer caches can detect it.
- [x] Load stored descriptors after `AccountCatalogStore.load()` and apply them to `state.providers`; update metadata and publish only after a store write succeeds.
- [x] Expose IPC methods through `src/main/preload.ts`, validating all provider IDs and selection values in the main process.
- [x] Run `npm run typecheck` and `git diff --check`; inspect corrupt-store fallback, path construction, and PNG size checks without running tests or builds.

### Task 2: Add tab-menu picker and consistent icon rendering

**Files:**

- Modify: `src/main/main.ts`
- Modify: `src/renderer/provider-navigation.ts`
- Modify: `src/renderer/shell.ts`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/shell.css`

**Interfaces:**

- The existing native provider tab context menu adds **Đổi logo** and requests the renderer dialog for that provider.
- The dialog uses the existing provider logos as bundled choices; each selection calls `setProviderLogo(providerId, {kind:"builtin", providerId: sourceId})`.
- Local PNG/JPG selection is center-cropped with canvas to a 64×64 PNG, then calls `setProviderLogo(providerId, {kind:"image", dataUrl})`; the main process assigns the authoritative revision.
- Reset calls `setProviderLogo(providerId, null)`.

- [x] Add **Đổi logo** to the existing right-click provider tab menu and send the provider ID through the preload event.
- [x] Add an accessible renderer dialog with bundled logo choices, PNG/JPG input, a 64×64 preview, error text, cancel, and **Dùng logo mặc định**.
- [x] Convert the selected local image using canvas center-crop to a PNG data URL; reject files over 10 MiB before decode and keep the current logo when conversion or save fails.
- [x] Update the shared `providerLogo` renderer to use a chosen bundled logo or asynchronously load/cache a provider image by `(providerId, revision)`; keep the existing built-in image/initials fallback while loading.
- [x] Header/library/account-card render signatures already include provider definitions; successful changes publish a new descriptor and remove the previous image revision from renderer cache.
- [x] Run `npm run typecheck` and `git diff --check`; inspect the dialog's keyboard/escape path and image failure states. Do not build or package.
