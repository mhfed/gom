# Reply Template Variable Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user fill named placeholders in a saved reply template, preview the result, and explicitly copy it.

**Architecture:** Add one shared parser/expander imported by the main and renderer bundles. The renderer collects ephemeral values and displays the preview; the main process verifies the values against the stored template and performs the guarded clipboard write.

**Tech Stack:** TypeScript, Electron, existing shelf IPC and clipboard boundary.

**Spec:** `docs/superpowers/specs/2026-11-05-template-variable-fill-design.md`

## Global Constraints

- “Không tự đọc chat, clipboard hay dữ liệu khách hàng; không tự điền từ nền tảng, tự chèn vào ô soạn, gửi tin hoặc đồng bộ qua mạng.”
- “Giá trị chỉ tồn tại tạm trong thao tác đang mở; xóa chúng sau khi hủy, sao chép xong, đóng Khay, khóa Không gian kín hoặc đổi không gian.”
- “Sao chép phải tiếp tục qua thao tác clipboard có kiểm tra không gian/phiên như các hành động Khay hiện tại; giá trị điền không được ghi log hoặc lưu vào mẫu.”
- “Mẫu thường và kín tiếp tục dùng kho riêng của từng không gian.”
- No new dependencies; do not alter the encrypted shelf storage format.
- Per repository task instructions, do not add or run tests unless requested. Keep the existing test and fixture files untouched.

## Review Focus

- Repeated labels with different casing resolve to one field and one value.
- Incomplete or invalid brace sequences remain literal text.
- Missing, extra, oversized, or non-string values fail without changing the clipboard.
- Locking or changing spaces while the fill form is open clears every entered value; stale actions cannot copy.
- User values and previews remain inert text and never become HTML.

Implementation limits chosen for this increment: at most 20 unique fields, labels of 1–60 Unicode code points, values of 0–500 Unicode code points, and expanded output of at most 64 KiB UTF-8. Field keys are trimmed, NFC-normalized and case-folded with the Vietnamese locale; the first spelling remains the visible label. Invalid or incomplete tokens are literal text.

---

### Task 1: Add shared placeholder parsing and expansion

**Files:**
- Create: `src/template-variables.ts`

**Interfaces:**
- Produce `scanTemplateVariables(body: string): { fields: { key: string; label: string }[]; error?: string }`.
- Produce `expandTemplateVariables(body: string, values: Readonly<Record<string, string>>): { ok: true; text: string } | { ok: false; message: string }`.
- Scan complete `{{label}}` tokens in appearance order, deduplicate by normalized key, preserve the first visible spelling, and leave invalid/incomplete sequences untouched.
- Expansion requires exactly one string value for every scanned key, checks per-value and expanded UTF-8 limits, and replaces every occurrence of each key.

- [x] Implement the shared parser and expander with the limits and normalization above; keep the module free of DOM, Electron and Node-only APIs so both bundles can import it.

### Task 2: Validate substitutions at the clipboard boundary

**Files:**
- Modify: `src/shelf-types.ts`
- Modify: `src/main/shelf-service.ts`
- Use: `src/template-variables.ts`

**Interfaces:**
- Extend `ShelfRequest` with optional `values?: Record<string, string>` for `copy-template` only.
- `copy-template` without fields keeps the current exact request shape and copies the stored body unchanged.
- `copy-template` with fields accepts only `{ action, lockVersion, templateId, values }`; validate exact value keys, types and limits against the template loaded from the current space.

- [x] Add the optional values payload type without changing other shelf request actions.
- [x] Expand the stored template body inside the existing serialized/guarded copy operation, recheck the privacy epoch immediately before `writeText`, and return a user-facing error without writing clipboard data on any mismatch.

### Task 3: Add fill form, live preview and user instructions

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/shelf.ts`
- Modify: `src/renderer/shell.css`
- Modify: `docs/transfer-shelf.md`
- Use: `src/template-variables.ts`

**Interfaces:**
- Template cards with no variables continue to use the current one-click explicit copy action.
- Template cards with variables open an accessible in-panel form with one input per unique field, a live text-only preview, **Hủy**, and an explicit **Sao chép** button.
- The renderer sends only the template ID and field-value map; it never sends a replacement body to the main process.

- [x] Add fill-form markup and accessible input/preview/status labels within the existing template panel.
- [x] Implement temporary fill state, live preview with `textContent`, explicit copy, cancel-without-clipboard-change, focus restoration, and cleanup on close/reset/lock/space change.
- [x] Reuse existing shelf styles and keep item-tab behavior unchanged.
- [x] Document `{{nhãn}}` usage, repeated-field behavior, preview/copy steps, and that values are not saved or sent automatically.

## Final Review

- [x] Review changes against the spec and confirm there are no edits to provider pages, clipboard reads, automatic insertion/sending, persistence, logging, or network sync.
- [x] Do not run tests or build/typecheck commands unless the user requests verification.
