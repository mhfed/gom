# Conversation-Linked Reply Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen a reminder's account at its saved internal conversation URL when the provider exposes that route.

**Architecture:** Main captures the selected account view's validated URL into the encrypted reminder store. ReminderService passes it only to main-process navigation; renderer receives only a boolean link indicator. Sleeping views start directly at the saved URL.

**Tech Stack:** Electron WebContentsView, existing navigationPolicy, encrypted ReminderStore, TypeScript renderer.

**Spec:** docs/superpowers/specs/2026-11-02-reminder-conversation-link-design.md.

## Global Constraints

- Do not read chat DOM or message content.
- Save only a trusted internal http(s) URL with no credentials and a maximum length of 4096 characters.
- Keep the raw target URL encrypted and inside the main process; renderer receives only whether a target exists.
- Invalid or unsupported links fall back to opening the account and never open externally.
- Preserve old reminders, notification behavior, account authorization and lockVersion guards.
- No tests, typecheck or build commands in this session.

## Review Focus

- Legacy reminders without a URL still open their account.
- Invalid, external, overlong or credential-bearing URLs are rejected or safely ignored.
- Waking a sleeping account loads the saved target on its first navigation.
- Workspace lock or account changes still cancel stale open operations.
- Renderer snapshots and native notifications never expose raw conversation URLs.

---

### Task 1: Persist and safely open conversation URLs

**Files:** src/shared.ts, src/main/reminders.ts, src/main/reminder-service.ts, src/main/main.ts.

- [x] Add an optional encrypted URL field with strict syntax/size validation and backward-compatible parsing.
- [x] Capture a non-default URL from the selected account view on reminder creation; return honest success feedback if no link was available.
- [x] Validate saved URLs again before opening, route wake creation directly to the URL, and retain the existing account/session partition.
- [x] Filter raw URLs from renderer snapshots and pass links only through the main-process reminder service.

### Task 2: Explain link availability in the reminder UI

**Files:** src/renderer/reminders.ts, src/renderer/index.html.

- [x] Explain that Gom saves a link only when the platform exposes the conversation in its URL.
- [x] Label linked reminders “Mở cuộc trò chuyện” and reminders without links “Mở tài khoản”.
- [x] Display success feedback distinguishing the two cases.

### Task 3: Review and record limits

**Files:** docs/superpowers/specs/2026-11-02-reminder-conversation-link-design.md, docs/superpowers/plans/2026-11-02-reminder-conversation-link.md.

- [x] Review storage encryption, URL validation, private-space projection, wake navigation and user-facing fallback copy.
- [x] Record that unsupported single-page routes require the user to select the conversation after opening the account.

## Execution notes

- The user already authorized this feature as the second step in the selected sequence; no new approval round.
- Preserve existing unrelated workspace changes. A later user instruction authorizes a source branch commit and push for review; packaging and release remain out of scope.
- Tests, typecheck and build are not run or added under the active session instruction.

## Completion ledger

- Task 1: implemented — optional URL remains inside encrypted storage and main-process navigation.
- Task 2: implemented — linked reminders show “Mở cuộc trò chuyện”; unsupported routes are explained and fall back to the account.
- Task 3: independent read-only review complete. The final review found no actionable issues after the feedback toast was moved into the shell header. Runtime and build verification are not claimed.
