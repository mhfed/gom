# Transfer Shelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the approved persistent transfer shelf without shipping or installing it yet.
**Architecture:** Main owns an encrypted, namespace-scoped store and a service that checks workspace epochs at every asynchronous boundary. The trusted shell renders a right drawer; native provider geometry reserves its area. Clipboard and OS dialogs remain explicit user actions.
**Tech Stack:** Electron 45, TypeScript, Node crypto/fs, existing vanilla DOM/CSS, node:test and isolated Electron smoke fixtures. No new runtime dependency.
**Spec:** `docs/superpowers/specs/2026-10-29-transfer-shelf-design.md` (approved by “làm đi bạn ơi”, 2026-10-29).

## Global Constraints

- 100 items, 250 MiB total per namespace; 50 MiB per image/file; 64 KiB UTF-8 text; at most 10 files per picker. Preserve LF/tab. No automatic expiration.
- Main derives `normal`/`private`; all renderer requests require current `lockVersion`. Never accept arbitrary paths or namespace over IPC.
- AES-256-GCM for index/blob payloads with fresh nonces and namespace/ID authenticated data; random data key protected by OS safeStorage. Fail closed, retain original bytes on crypto/read/write failure.
- Keep native view/session/draft identity. Drawer is 340 px below 52 px header; at widths below 940 px hide native view and use full content drawer.
- Manual clipboard/file selection; text/link context actions; no scraping, auto sending, direct download capture, drag-out or new network service.
- Preserve floating reload/36 px bubble fix, private spaces, source app identity and four unrelated untracked docs. Reminder WIP stays separate. No version bump, installer, publish or /Applications replacement.

## Review Focus

- Returning callbacks after normal → private → normal must be rejected even though namespace matches again (service race test + smoke).
- Failed metadata commit must not replace existing state or expose orphan blob (store failure/restart tests).
- Malicious HTML/filenames or oversized images must remain inert and bounded (UI hostile-text smoke + service size tests).
- Resizing/opening/closing while provider is detached must preserve each window's bounds and native ID (geometry + native smoke).
- A stale delete/pin/clear/export must never affect another namespace, clipboard, or existing destination file (service tests + smoke).

## Shared interfaces (root owns `src/shelf-types.ts`)

`ShelfKind = "text" | "link" | "image" | "file"`.
`ShelfItem = {id:string,kind:ShelfKind,createdAt:number,pinned:boolean,name:string,bytes:number,mime:string,text?:string}`.
`ShelfSnapshot = {items:ShelfItem[],totalBytes:number,revision:number,unavailable:boolean,error:string}`.
`ShelfSummary = {count:number,totalBytes:number,revision:number,unavailable:boolean,open:boolean}`.
`ShelfRequest = {action:"surface"|"list"|"add-text"|"clipboard"|"pick-files"|"pin"|"remove"|"clear"|"copy"|"export"|"preview",lockVersion:number,id?:string,text?:string,pinned?:boolean,open?:boolean}`.
`ShelfResult = {ok:boolean,message?:string,snapshot?:ShelfSnapshot,dataUrl?:string}`.
`AppState.shelf?:ShelfSummary`; `DesktopBridge.shelf(request:ShelfRequest):Promise<ShelfResult>`.
`SHELF_LIMITS = {items:100,totalBytes:262144000,itemBytes:52428800,textBytes:65536,pickerFiles:10,imagePixels:16000000,previewBytes:262144,previewEdge:320}`.

### Task 1: Encrypted persistent store

**Files:** create `src/main/shelf-store.ts`, `tests/shelf-store.test.ts`.
**Interfaces:** export `ShelfNamespace = "normal"|"private"`; `ShelfKeyCodec = {available():Promise<boolean>,encrypt(text:string):Promise<string>,decrypt(encoded:string):Promise<string>}`; `ShelfStore(root:string,codec:ShelfKeyCodec)`.
Methods: `load():Promise<void>`, `list(space):ShelfSnapshot`, `addText(space,text,valid?:()=>boolean):Promise<ShelfResult>`, `addBinary(space,{kind:"image"|"file",name:string,mime:string,data:Buffer},valid?):Promise<ShelfResult>`, `pin(space,id,pinned,valid?)`, `remove(space,id,valid?)`, `clearUnpinned(space,valid?)` all `Promise<ShelfResult>`; `readBinary(space,id):Promise<Buffer|null>`, `flush():Promise<void>`.
Mutations serialize, guard before commit, copy snapshots. Validate all parsed fields and stable IDs; sanitized basename; reject unsafe controls, no user data in errors. Store only encrypted originals (preview generated in memory). Per-namespace encrypted index, UUID blobs, OS-wrapped key. Atomic writes, safe orphan cleanup only after healthy index load, reject missing key for existing store, preserve errors instead of reset.

- [x] Write/observe failing real filesystem tests for restart/namespace isolation, LF preservation, quotas, tampered cipher/key, guarded mutation, concurrent writes, copy bytes, pin/clear/delete, failed commit and orphan cleanup.
- [x] Implement store and run its tests GREEN, then whole unit suite. Record evidence/report; controller commits only owned files.

### Task 2: Shelf drawer UI

**Files:** create `src/renderer/shelf.ts`; modify `src/renderer/index.html`, `src/renderer/shell.css`, `src/renderer/shell.ts` only shelf integration. Create `scripts/shelf-ui-check.mjs` if headless layout QA is useful.
**Interfaces:** export `createShelfUI({getState:()=>AppState|undefined,request:(request:ShelfRequest)=>Promise<ShelfResult>}):{render(state:AppState):void,conceal():void}`. `render` called in shell render; state is authority for `shelf.open`. Bind toolbar and drawer controls within module. Requests always capture lockVersion; discard stale results and clear caches/inputs on epoch change. `conceal` drops DOM/caches and closes UI, with close request if still current.
Root supplies shared types and preload; do not edit those. Use `#shelf-toggle`, `#shelf-panel`, `#shelf-list`, `#shelf-search`, `#shelf-add-text`, `#shelf-text`, `#shelf-from-clipboard`, `#shelf-pick-files`, `#shelf-clear`, `#shelf-close`, `#shelf-status`. Root sets authoritative `AppState.shelf.open`; CSS body class can reserve shell panels but native geometry is main-owned. Existing modals conceal via main-state update and UI clears with render.

- [x] Write RED UI fixture demonstrating absent controls; implement all approved add/filter/search/pin/delete/clear confirmation/copy/export/preview/expand flows with inert text and stable focus. Avoid rebuilding list on unrelated polls.
- [x] Honor existing product theme, keyboard/aria/empty/error/loading/quota states; use 340 px drawer/940 px threshold and private helper copy.
- [x] Run typecheck and headless visual QA light/dark, 940/1280/400 px, hostile names, multiline/long content and stale async result. Record screenshots/report; controller commits owned files.

### Task 3: Main service, trusted bridge and native geometry (root)

**Files:** create `src/shelf-types.ts`, `src/main/shelf-service.ts`, `tests/shelf-service.test.ts`; modify `src/shared.ts`, `src/main/{main,preload,layout,private-state}.ts`, `tests/{layout,private-state}.test.ts` as appropriate.
**Interfaces:** `ShelfService` owns requests using injected store, current `{space,epoch,live}`, clipboard, file/save dialogs and image codec. Root decides constructor contract in source before tests; no Electron import in store/service tests. Preload forwards only request; main validates sender and service validates action/epoch, with no path capability. Main broadcasts summary only, surfaces errors without private data. Context menus capture visible selection/link with epoch. Geometry accepts optional reserved-right width, hide provider below threshold, excludes floating native view as today.

- [x] Write RED tests for stale epoch, namespace isolation, file descriptor validation, bounded clipboard/image decoding, safe export cancellation, summary projection and native bounds.
- [x] Implement service, OS adapters using Electron 45 async clipboard/safeStorage, metadata-only summary, startup/load/quit flush, close on modal/workspace transitions and focus restore only on valid close.
- [x] Run targeted tests GREEN, then typecheck/build and all units after integration.

### Task 4: Isolated end-to-end acceptance

**Files:** create `scripts/shelf-check.mjs`, update `README.md`, add `docs/transfer-shelf.md`; update this ledger/spec status.
Use existing fixture pattern with temporary home/userData, fake provider protocol, mock keychain, clipboard/dialog doubles only at OS boundary, never production sessions. GUI suites run sequentially.

- [x] Observe RED against absent shelf bridge; verify add text/link/image/file, true restart persistence, byte-for-byte export, clipboard output, immutable source copy, clear keeps pins, namespaces and hostile input.
- [x] Verify stale picker/preview/export/IPC after lock and switch-back, main/native bounds/drafts/floating identity, small/light/dark UI, unavailable crypto/corrupted index preserves original bytes, clean quit.
- [x] Run typecheck + all unit tests + build + shelf smoke, native tabs/private/floating suites affected by integration. Review scoped modules and final branch independently, fix material findings and repeat affected checks.
- [x] Commit source/docs only, report exact evidence and remaining real-platform limits. Leave build/install/release pending user's request.

## Execution ledger

- Baseline: 178/178 unit tests pass, 2026-10-29; checkout `codex/transfer-shelf` based on popup fix and approved design commit `a9df171`.
- Ruling: continue in the existing feature checkout — branch already isolates main and preserves four user's untracked docs; no worktree/cwd move is needed for this task.
- Ruling: user “làm đi bạn ơi” authorizes continuous execution of the approved design; no repeated plan approval question.
- Ruling: delegate independent store/UI and smoke ownership in parallel per active developer instruction; root alone integrates shared types/main/service, and only root stages commits to avoid shared-index races.


## Kết quả triển khai — 2026-10-29

- Đã triển khai toàn bộ phạm vi thiết kế ở nhánh `codex/transfer-shelf`. Source build giữ phiên bản0.8.0; không có installer, cài đặt hay phát hành mới.
- Kiểm chứng cuối: typecheck/build/format/diff check đạt, **211/211 unit tests**, **10 nhóm Electron Khay**, **16 nhóm native tabs**, **17 nhóm Không gian kín**, **12 nhóm chat nổi**. Giao diện sáng/tối1280/940/400px và phản hồi10file tại400×640/940×640 đạt; snapshot không đổi tạo0DOMmutation.
- Review kho phát hiện index read cap và nhãn hostname không an toàn; hai regression đã RED→GREEN, scoped review sạch. Whole-branch review phát hiện shutdown cleanup, rename cancellation và phản hồi batch; đã sửa và kiểm tra lại. Hai lỗi DOM idle và status overflow cũng đã có regression RED→GREEN. Không còn P1/P2 trong lượt rà soát cuối.
- Ruling: cập nhật fixture native vốn giả định3provider lên8provider của baseline, chín nativeview và điều hướng theo visible tab/overflow. Foreground recovery bắt buộc kiểm tra selection/nativevisibility đúng trước, không sửa hộ một click sai. Nếu sai quyết định này sẽ làm yếu regression; scoped reviewer đã rà lại các assertion.
- Ruling: sửa cache welcome-card của baseline để giữ hợp đồng0mutation thay vì nới test. Cache xét không gian/epoch, thứ tự tài khoản, tên, logo và chưa đọc; thay đổi thật vẫn cập nhật. Rủi ro stale display được phủ bằng fixture cập nhật tên/logo/unread/count/namespace.
- Ruling: giữ code ở nhánh hiện tại, không push/merge/cài đặt, theo phạm vi đã duyệt. Tính năng chỉ dùng được sau bước chạy bản phát triển hoặc đóng gói riêng về sau.
- Giới hạn: fixture OS boundary giả, chưa có live keychain/dialog/provider/Windows acceptance. Xem `docs/verification-transfer-shelf.md` và `docs/transfer-shelf.md`.
