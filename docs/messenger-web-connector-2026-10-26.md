# Messenger web connector: evidence and read-only inspection

Date: 2026-10-26. Status: research only; no production connector implemented or
verified by this review. The user accepted experimental web connectors, with a
release only after verification. This document describes a narrow first stage;
it does not claim that the unified Messenger inbox is working.

## Evidence collected

- `src/main/main.ts` owns the `AccountId -> WebContentsView` registry and account
  session partition. Provider views have `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true`.
- `platform-preload.ts` currently exposes only the notification-click bridge.
  It does not expose shell IPC, filesystem, credentials, or message data.
- `detectOnce()` already checks current view identity, loading, navigation
  policy, recovery state, destruction and navigation epoch before accepting a
  result. Its snapshot contains auth status, unread aggregate and theme only.
- The epoch advances for full navigation and renderer crashes. Same-document
  navigation only publishes state. A connector must additionally invalidate
  in-flight thread-specific results on same-document navigation or a verified
  selected-thread change.
- `accountPartition()` preserves existing legacy partitions and uses a distinct
  persistent partition for every additional account. No migration is needed
  for an adapter that reads the existing web client.
- Existing auth detection is a UI heuristic. For Messenger it recognizes a
  Chats heading and a new-message control. It does not identify the logged-in
  person or establish that encrypted history has been restored.
- A read-only process inventory found no running Tin Nhan/Electron app at the
  time of this review. No app was launched or closed, and no personal profile
  was read.
- Public web retrieval of `https://www.facebook.com/messages/` returned a login
  redirect; `https://www.messenger.com/` also redirected to login. These are
  unauthenticated retrievals (one result was cached), not evidence of the
  current authenticated chat DOM. No conversation or message selector was
  established.

`scripts/live-check.mjs` is not a suitable inspector unchanged: its launch
path uses the normal app profile, and it contains account activation, import,
cookie inspection, network-response inspection, and screenshots. Do not run it
as the first research probe. Production has no existing connector inspection
IPC that a separate process can invoke safely.

## Narrow inspection sequence

1. Build and review the probe against synthetic pages in a fresh temporary
   profile first. Fixtures must include login/password fields, malicious text,
   large DOMs, duplicate rows, empty/loading states, navigation races and
   editable drafts. This verifies the probe's boundaries, not real selectors.
2. When an existing app/view is available, target one explicit AccountId and
   the registry-owned principal view. Never choose a view by title, DOM account
   name, origin alone or the first matching `webContents`. Exclude popups,
   subframes, settings, archived accounts and import staging views.
3. Run one bounded structural read in an isolated world of the main frame.
   Prefer a host-initiated request with a request ID to a permanent page API.
   Do not expose a generic execute-script or message-send channel to the page.
4. The first result contains only tag/role counts, attribute *names*, the
   presence of structural candidates, loading/error indicators, and bounded
   timing/size metadata. Do not return message text, contact names, avatar/media
   URLs, full links, raw IDs, HTML, arbitrary aria-label values, form values,
   hidden inputs, scripts, storage, cookies or network bodies.
5. Keep traversal bounded by node count and elapsed time. Avoid `innerText`,
   full-document HTML, layout measurements and unbounded selectors. One manual
   request, one result; no permanent observer or polling at this stage.
6. Validate the response schema in the main process. Confirm the same view,
   main frame, allowed HTTPS origin, account binding, navigation generation and
   request ID before accepting it. Fail closed on unexpected data, missing
   candidates, login, checkpoint, crash or encryption recovery state.
7. To prove identifier behavior later, use user-selected test conversations and
   compare opaque, session-local pseudonyms computed before data leaves the
   frame. Raw participant/thread/message identifiers are not diagnostic output.
   Pair these observations with user navigation; the probe itself must not
   open threads, scroll, focus, mark read, alter text or send events.

No stage above calls fetch, XMLHttpRequest, WebSocket, internal application
modules, React stores, GraphQL endpoints or service-worker APIs. It must not
click, dispatch input events, scroll, focus/blur, change selection, reload,
replace a view, change cookies, export encryption keys or call `loadURL()`.
Normal provider behavior while the user operates the page remains outside the
probe; do not describe the whole session as free of provider-side effects.

## Required evidence before selecting real DOM selectors

| Area | Evidence required | Failure behavior |
| --- | --- | --- |
| Account routing | Host AccountId and view identity; detect reauthentication/account changes before reusing caches | Invalidate connector binding; never infer identity from display name |
| Conversation key | Same opaque key across repeated samples, manual selection, return navigation and reload; distinct keys for same-named contacts/groups | Do not use display names, row index, text hash or DOM position as durable identity |
| Message key | Distinguishes identical text/time, survives pagination, edit/reaction and reload, and can map a later provider acknowledgement | No complete-history or reliable-send claim without stable identity |
| Virtualization | Observe nodes disappearing/reappearing during user scrolling; establish loaded range and pagination boundaries | Label data as the loaded window; absence must not mean deletion |
| Selected thread | A verified marker maps selected conversation to message container and composer in the same observation | Do not merge messages or draft into another thread |
| E2EE/recovery | Distinguish ready history, PIN/recovery prompt, loading and unavailable older messages | Keep recovery in official UI; report unavailable rather than empty history |
| Ordering | Verified order/timestamps and behavior around day separators, retries, deleted/edited messages and system events | Preserve unknowns; never fabricate timestamps or sender identities |
| Drafts | Passive sample leaves draft, caret, focus and composition untouched; account/thread switching restores correct web draft | Keep web drafts owned by provider until separate draft interoperability is proven |
| Variants | Evidence from Vietnamese/English, light/dark, narrow/wide windows, personal/group threads and multiple accounts | Disable unsupported variant rather than guessing a fallback selector |

The current review has no authenticated DOM evidence for any of these cells.
A fixture-only pass cannot satisfy them.

## Next adapter boundary after inspection

The first useful experimental capability should be read-only, explicitly
limited to the currently loaded conversation window. It should return a
typed, bounded snapshot through the host-owned account binding and report
capabilities and coverage separately from data. Uncertain identity, stale
generation, unsupported DOM or encryption recovery must disable the capability.

Keep selectors versioned and validate structural invariants before extracting
content. Treat all returned text as untrusted; render as text, validate URLs
separately, and never render provider HTML in the shell. Any observer added
later must be scoped, coalesced, disconnected on navigation/disposal and measured
for background CPU and memory. A second UI layered over the existing web client
does not inherently reduce webview memory.

Sending is a separate stage. It needs a verified selected-thread/account
binding, preservation of the official composer draft, explicit user action,
provider acknowledgement, duplicate-send handling and safe timeout behavior.
There is no send path authorized or implemented by this read-only probe.

## Official context

- [Meta's official Messenger Platform workspace](https://www.postman.com/meta/messenger-platform-api/overview)
  and [Conversations API](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a)
  describe Facebook Page/Instagram Professional conversations; they do not
  establish support for this personal-account DOM adapter.
- [Meta's E2EE architecture](https://engineering.fb.com/2023/12/06/security/building-end-to-end-security-for-messenger/)
  describes device keys and encrypted history. [Secure Storage guidance](https://about.fb.com/news/2024/03/end-to-end-encryption-on-messenger-explained/)
  distinguishes restoring history from simply signing in.
- [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents)
  provides script evaluation, including isolated worlds. This is an Electron
  capability, not a stable Messenger DOM contract.

No personal messages, login credentials, cookies, drafts or encryption material
were read or written during this review. No messages were sent.

Root follow-up: the existing 0.5.2 app was subsequently opened for the authorized
research. Its state and a structural-only probe confirmed Messenger was still
at a login page. The user deferred signing in and asked to continue automatic
work. Thus this does not change the unverified status of Messenger chat selectors.
