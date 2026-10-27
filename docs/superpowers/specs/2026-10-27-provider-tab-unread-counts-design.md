# Provider tab unread counts

## Intent

Show a numeric unread badge on each provider tab so unread activity remains visible in the app without relying on macOS notification banners.

## Goals and constraints

- Replace each provider tab's unread dot with a count when a positive count is available.
- Aggregate counts across that provider's non-archived built-in accounts. Each provider reports one count kind (Zalo messages; Messenger and Telegram conversations).
- Preserve uncertainty: append `+` when any contributing count is approximate or unavailable; cap large values at `99+`.
- Hide the badge for known zero or when no positive count is known. Keep accessible labels descriptive.
- Keep the Dock indicator as a dot; do not combine message counts and conversation counts across providers.

## Approaches

1. **Numeric count on each provider tab — selected.** User chose this placement. It ties each count to its provider and avoids presenting a misleading cross-provider total.
2. Numeric count on the Dock for providers with unread activity. This is defensible but less useful than identifying which provider has unread items, and is not the requested placement.
3. Sum every unread count into one Dock total. Rejected because counts mix messages and conversations and can be lower-bound estimates.

## Implementation calls

- Sum known per-account counts within the same provider; mark the aggregate approximate if any account count is approximate or unavailable.
- Reuse the existing `badgeText` formatting (`n`, `n+`, `99+`). Unknown counts do not imply unread activity and therefore do not create a badge on their own.
- This is an in-app indicator only. It does not add native macOS notifications or change their signing requirements.

## Out of scope

No Dock numeric badge, new notification delivery path, unread detection changes, or account data changes.
