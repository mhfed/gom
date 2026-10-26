# Open provider tabs and custom websites

The user approved the “Tab đang mở” mock and explicitly requested implementation of pinned tabs, overflow navigation, and adding personal websites. Keep Gom's 52px header, colors, existing account picker, and native service views.

## Behavior

- Tabs represent providers; accounts remain separate. An activation from any entry point opens the provider tab and remembers the provider's last account.
- Pinned tabs show logos/initials. Ordinary tabs show a truncated name and close control. A context menu provides pin/unpin and close actions; the provider library also exposes pinning.
- Width determines how many tabs fit. Always keep the current provider visible. All hidden tabs remain available through an anchored native menu. The plus button opens a searchable provider library with a name/URL form for custom websites.
- Closing a tab never removes its provider, account, cookies, or login storage. Closing the last tab opens the provider library. Custom website views load lazily and may be closed to release resources after storage flush; existing built-in messaging behavior remains available for notifications.
- Store open and pinned provider IDs separately from existing account pins. Restore them on restart, retaining legacy account/session identities.
- Custom websites get generated IDs, a default isolated account, initials as the icon fallback, and the same sandboxing as built-ins. Accept explicit HTTP/HTTPS URLs, including ports, but reject credentials, invalid hosts and privileged schemes. Trust only their configured origin for in-app navigation and permissions. External destinations keep the existing explicit browser-opening flow.
- Custom sites have no invented unread count or messaging login detection. Provider definitions and initial accounts are committed atomically. Existing corrupt-catalog protection remains in place.

## Approach

Chosen: open tabs with pins and overflow, matching the approved mock. A single provider picker saves space but costs another click on frequent switches. Workspace grouping supports organization but adds a level the user did not choose.

Use a version 2 account catalog containing custom providers and accounts, and migrate version 1 without replacing IDs. Expose ordered provider definitions and a separate `providerTabs` state. Use native menus above WebContentsView; use a full shell panel for the searchable library and add form.

Scope is implementation and local verification. Packaging/publishing will be handled when requested. No change to real user profiles during tests.
