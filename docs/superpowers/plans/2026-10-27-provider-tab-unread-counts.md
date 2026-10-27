# Provider Tab Unread Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each provider's unread count on its tab, giving the user a visible in-app signal when native macOS banners are unavailable.

**Architecture:** Keep unread state per account and aggregate only when rendering that account's provider tab. Reuse the existing `badgeText()` formatter, update the tab's accessible label and badge element, and style the numeric badge in the existing provider-tab CSS. The Dock remains a dot.

**Tech Stack:** Electron 45, TypeScript, DOM renderer, CSS, esbuild.

**Spec:** `docs/superpowers/specs/2026-10-27-provider-tab-unread-counts-design.md`

## Global Constraints

- Aggregate counts across that provider's non-archived built-in accounts. Each provider reports one count kind (Zalo messages; Messenger and Telegram conversations).
- Preserve uncertainty: append `+` when any contributing count is approximate or unavailable; cap large values at `99+`.
- Hide the badge for known zero or when no positive count is known. Keep accessible labels descriptive.
- Keep the Dock indicator as a dot; do not combine message counts and conversation counts across providers.
- This is an in-app indicator only. It does not add native macOS notifications or change their signing requirements.

## Review Focus

- Multiple accounts under one provider: aggregate only accounts for that provider and propagate approximate/unknown state with `+`.
- All accounts known zero or no known positive count: keep the tab badge hidden.
- Values above 99: preserve the existing `99+` cap.
- Selected and overflowed tabs: retain their count when visible, and preserve tab selection and overflow behavior if the wider tabs cause earlier overflow.
- Accessibility: include the numeric count in the tab's accessible label and avoid announcing only an unread dot.

---

### Task 1: Render provider-specific unread counts

**Files:**
- Modify: `src/renderer/provider-navigation.ts`
- Modify: `src/renderer/shell.css`
- Read-only dependency: `src/main/unread.ts` (`badgeText()`), imported from the renderer as a pure helper; it has no main-process runtime dependencies.

**Interfaces:**
- Consumes: `AppState.accounts`, `AppState.unread`, and `AppState.providers`.
- Produces: each provider tab's existing `.platform-unread` element contains formatted numeric text when the aggregate is positive; otherwise it is hidden.

- [ ] Aggregate non-archived, non-custom account unread values by provider. Sum known counts; mark the aggregate approximate when any member is approximate or unavailable. If the known total is zero, show no badge.
- [ ] Format positive totals with `badgeText()` and write the same count into the provider tab's accessible label.
- [ ] Style the existing badge element for compact numeric values, including `99+`, in selected and overflow tabs. Reserve 30px in each unpinned built-in tab's computed width for the badge and its gap; the existing overflow control handles reduced header capacity. Custom tabs keep their current width, and pinned built-in tabs overlay the badge on the icon.
- [ ] Review the resulting diff and the exact/approximate/unknown/zero/overflow cases listed above. Do not add or run automated tests unless the user requests verification.
