> Đã dừng theo yêu cầu mới: chat riêng từng nền tảng. Nội dung dưới đây là lịch sử nghiên cứu, không còn là điều kiện phát hành. Xem [phạm vi 0.5.3](2026-10-26-platform-tabs.md).

# Unified Chat Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build verified data connections before packaging the approved unified chat design.

**Architecture:** Keep existing Electron web partitions and the EVKey/performance fixes. Normalize connector events by account and stable conversation ID; store new app drafts separately. Telegram uses TDLib if its native runtime passes a smoke check. Zalo/Messenger web adapters remain experimental and unavailable for send until real identities, routing and acknowledgements have evidence.

**Tech Stack:** Electron 45.0.0, TypeScript 7, Node tests, Playwright; TDLib/tdl pending runtime verification.

**Spec:** `docs/superpowers/specs/2026-10-26-unified-chat-design.md`

## Global Constraints

- Keep Electron and the approved Mac minimal design, tabs Tất cả / Zalo / Telegram / Messenger.
- Preserve existing login partitions and drafts; never migrate or clear Chromium databases.
- Background CPU first, then RAM; no continuous polling added for the unified interface.
- User approved experimental web research, release only after verification.
- No real outgoing test messages without a recipient/content instruction or a user action.
- No fake chat data in a release; fixture evidence is not live-provider verification.
- Work in the current authorized dirty workspace without resetting earlier fixes or making unrelated commits. Research changes are isolated in new modules/scripts and do not enable a production connector.

## Review Focus

- Two accounts with identical conversation IDs must never share drafts/messages.
- A late event after logout/account switch must not overwrite a current conversation.
- A partial or virtualized DOM snapshot must not delete unseen history or claim a complete inbox.
- An ambiguous send timeout must never retry automatically or discard the draft.
- Failure to decrypt/read a draft file must preserve the file and prevent silent overwrite.

### Task 1: Prove transport access without credentials or sending

**Files:** `scripts/research/telegram-*`, `scripts/research/web-inspect.mjs`, `scripts/research/web-structure.ts`, `docs/telegram-connector-2026-10-26.md`, `docs/zalo-web-connector-2026-10-26.md`, `docs/messenger-web-connector-2026-10-26.md`.

**Interfaces:** Reports expose exact versions, tested capabilities, unavailable capabilities and repeatable commands. Web inspection only reports DOM structure/aggregate counts and never input values, cookies, tokens, text content, URLs with parameters or network response bodies.

- [x] Verify TDLib native create/wait-parameters/close inside Electron 45 arm64 utilityProcess, with a temporary directory and no API credentials.
- [x] Inspect currently available official web pages; record whether an authenticated DOM is actually available. Do not invent provider selectors from synthetic fixtures.
- [x] Produce a bounded diagnostic script for authenticated DOM inspection that cannot click/type/send or dump private text.
- [x] Record whether stable conversation/message IDs and sender/delivery state can be verified. Missing live authentication is an explicit dependency for Task 3, not a successful connection.

### Task 2: Account-scoped message and durable draft foundation

**Files:** Create `src/chat/model.ts`, `src/main/chat/draft-store.ts`, `tests/chat-model.test.ts`, `tests/chat-drafts.test.ts`.

**Interfaces:** `ConversationRef {accountId, conversationId, topicId?}`, `conversationKey(ref): string`; `DraftStore(path, codec)` with `load()`, `get(ref)`, `save(ref,text,expectedRevision)`, `remove(ref,expectedRevision)`. Codec is injected and production will use Electron safeStorage; no plaintext fallback. Saves are serialized and atomically renamed; revision conflicts reject stale editor changes.

- [x] Write failing tests for colliding IDs, topic separation, invalid IDs, disk round-trip, unchanged drafts, simultaneous stale writes, corrupt/decryption failure and missing-file initialization.
- [x] Run `node --test --experimental-strip-types tests/chat-*.test.ts`; confirm feature absent.
- [x] Implement the narrow model and draft store; no changes to existing web drafts or runtime wiring.
- [x] Re-run tests, `npm test`, `npm run typecheck`; all must pass.

### Task 3: First real read-only connector slice

**Dependencies:** Task 1 evidence, an authenticated page for personal web adapters; Telegram application credentials entered locally and user authentication for TDLib.

**Files:** Provider adapter files under `src/main/chat/` and provider-specific tests, fixed after Task 1 reveals actual DOM contracts.

**Interfaces:** Events include account binding, session generation, stable conversation/message IDs, coverage (`visible` vs `complete`) and capability flags. No provider may advertise send or complete history based on DOM presence alone.

- [ ] Implement only evidence-backed identity/list/history extraction, with sanitized fixtures derived from that evidence.
- [ ] Test virtualization, no-ID rows, duplicate message text, account generation change and empty/expired login pages. Fail closed when identities are missing.
- [ ] Verify against an authenticated account without sending; report loaded coverage honestly.
- [ ] Add a bounded event subscription with cleanup and coalescing, measure idle CPU before enabling it.

### Task 4: Compose/send and approved UI integration

**Dependencies:** Verified read-only connector and a documented send/ACK contract for each enabled provider.

- [ ] Plan provider-specific send commands after routing/ACK evidence exists; preserve native drafts and do not retry an ambiguous attempt.
- [ ] Connect the approved two-column UI to real events and durable drafts; show unsupported/partial states honestly.
- [ ] Test Vietnamese IME composition, account/platform switching, persistence after restart, offline/reconnect, late events and send failure using fixtures; user performs any real sends.
- [ ] Measure foreground/background CPU/RAM in matched conditions and repeat packaged IME/security/session checks before making an installer.

## Execution record

- Task 1 complete as a feasibility checkpoint, not provider verification. TDLib native smoke passed independently twice. The authorized 0.5.2 app was opened; Zalo/Telegram web sessions were authenticated and Messenger needed login. User deferred manual login/conversation selection.
- Task 2 complete, 17 tests; independent review found no correctness issues in its narrow scope. Production safeStorage/renderer integration remains Task 4 work.
- Task 3 partial: implemented `src/main/chat/zalo-dom.ts` with 10 tests. Real summary-only probe recognized 13 conversation rows after excluding a source-backed utility row. No message pane was open; no history/send/ACK implemented. Parser remains unintegrated.
- Review fixes: exclude Zalo utility IDs and classify password/PIN overlays as blocked (both reproduced RED then GREEN). Replace Playwright-owned real-profile diagnostic launcher with attach-only tooling and timeout/cleanup tests. The old harness was terminated separately; OS/CDP confirmed the app remained alive with the same PID.
- Verification: 89 unit tests plus 9 diagnostic-tool tests, typecheck and build pass. Root repeated the attach-only CLI and Zalo parser on the same app; exiting diagnostics did not close/restart it. See central progress report for evidence.
- Tasks 3/4 are deliberately gated by live evidence. Their implementation detail must be filled in from observed contracts, not guessed selectors.
- No installer is produced merely for completing Tasks 1/2.
