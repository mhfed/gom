# Provider library and Tinder design

Date: 2026-10-27

## Intent

Make “Mở một tab mới” easier to scan as the built-in provider list grows, and add Tinder as a first-class Gom provider. The page should still feel like Gom: quiet cream surfaces, teal actions, familiar system typography, and separate per-provider sessions.

## Scope

- Replace the single long provider list with compact cards grouped under “Giao tiếp”, “Hẹn hò”, and “Website riêng” for user-created providers.
- Keep search, result count, open status, pin/unpin, keyboard focus, and the custom-website form.
- Add Tinder as a built-in provider using Tinder’s official desktop site and a separate persistent Gom session.
- Request Tinder location access only after the user approves an in-app prompt; keep the grant scoped to that Tinder account session.
- Open Tinder’s official web login route and allow its exact first-party hosts plus Google’s restricted sign-in path.
- Add a local Tinder mark alongside the existing local provider logos.
- Do not add Bumble while Bumble Web is app-only. Revisit it if Bumble restores a desktop web experience.
- Add an explicit one-time Tinder Chrome-session handoff because Tinder auth is stored in browser storage rather than importable cookies. The user runs a copied snippet in the selected, signed-in Tinder tab; it sends only Tinder’s API token, device UUID, and MFA record to a nonce-protected loopback listener. Never read unrelated Chrome storage or send session data to a remote service.
- Keep Tinder unread-count support out of scope.
- Do not build or install a package without asking the user first.

## Approaches

1. **Compact grouped cards — selected.** Use a three-column card grid on the library side. Keep search at the top, group current communication providers together, and give Tinder a distinct “Hẹn hò” section. This uses the space better and makes the new category visible without changing Gom’s palette.
2. **Keep the list and add category filters.** This is a smaller layout change, but the provider list remains tall and users must switch filters to compare groups.
3. **Large discovery tiles.** This creates more visual impact but makes ordinary provider selection slower and competes with the custom-website form.

## Design direction

- **Color:** preserve the existing light palette (#f7f7f2, white surfaces, #d7e3dc borders, #0b7a75 accent) and its dark-theme tokens. Use Tinder’s mark only inside its card; do not recolor the whole dating section.
- **Type:** keep the system font; use the current heading scale, with compact group labels and provider names.
- **Layout:** preserve the two-column page: grouped provider cards on the left and the custom-website form on the right. Cards reflow to two columns and then one column at narrower widths. Search hides nonmatching cards and empty groups.
- **Signature:** a restrained “Hẹn hò” section header and Tinder card; this distinguishes a new kind of provider while keeping the rest of the screen calm.

```text
[ search providers                                      8 nền tảng ]

GIAO TIẾP                                      [ Thêm website riêng ]
[ Zalo       ] [ Telegram  ] [ Messenger     ] [ form ]
[ Gmail      ] [ Instagram ] [ Discord       ] [ form ]
[ Slack      ]                                  [ form ]

HẸN HÒ                                         [ form ]
[ Tinder     ]                                  [ form ]

WEBSITE RIÊNG
[ Custom A   ] [ Custom B  ]
```

## Provider behavior

Tinder opens the official desktop experience at tinder.com and uses the normal built-in provider session, account creation, pinning, and open-tab behavior. Navigation stays within Tinder’s trusted domains and explicitly supported sign-in redirects. Bumble is deferred because its current official web page says the service is app-only.

To move a Tinder session from Chrome, the user selects the Chrome profile, clicks “Dùng phiên có sẵn,” then runs Gom’s one-time snippet in the signed-in Tinder tab’s DevTools Console. The snippet posts only Tinder auth fields to a short-lived loopback endpoint; Gom injects them into that Tinder account’s isolated persistent session and rolls them back if Tinder redirects to login. A Tinder account with existing session data is never overwritten.

## Approval boundary

This document describes source changes only. The app build, install, and public release are separate actions; ask the user before building.
