# Zalo Web: evidence for a read-only DOM connector

Research date: 2026-10-26. Scope: public client assets, a bounded structural probe, and the subsequent summary-only check of one authenticated rendered inbox documented at the end. This report does **not** claim that a complete personal Zalo connector is implemented or that selectors are stable across releases. The live check supports only the currently rendered inbox rows; it does not verify history, sending, acknowledgement, or stability across navigation.

## Result

The public Zalo Web client contains identifiable DOM structure for rendered conversation rows and rendered text messages. A narrow, read-only **visible inbox preview** parser was implemented from that evidence as an unintegrated experiment, then checked against one authenticated inbox. Its output is limited to the rows currently in the DOM; it cannot claim complete history, realtime coverage, or message delivery.

The promising identity sources are a conversation wrapper's `anim-data-id`, text content IDs prefixed with `mtc-`, and bubble IDs prefixed with `bb_msg_id_`. These have different meanings and must not be interchanged. Actual identity persistence, account binding, active-conversation transitions, and coverage need authenticated-page observation.

## Public sources inspected

Fetched without cookies, authorization headers, login, or a persistent browser profile. Public code was read as text; no private protocol methods or application state were invoked.

The public [Zalo Web entry page](https://chat.zalo.me/) was 4,991 bytes and exposed app build `1b2d86e9567f6be024ce`. Its initial HTML had an empty, hidden `#app`, so HTML alone does not validate authenticated selectors.

| Source | Size | SHA-256 |
| --- | ---: | --- |
| [Runtime](https://zalo-chat-static.zadn.vn/v1/render.1b2d86e9567f6be024ce.js) | 203,527 | `8272a9745e3a0b19177cf5251f88ea1e013dbf87e83276090bc1e9d84150a487` |
| [Shared constants](https://zalo-chat-static.zadn.vn/v1/lazy/default-embed-render.2bae787e513bad5fdb28.js) | 944,870 | `5aa8052424938899297aa0f7904f4c53f2ea6b5b687fd6403c0a52f0143a11f3` |
| [Startup UI](https://zalo-chat-static.zadn.vn/v1/lazy/web-startup.734c636c89158c74fb14.js) | 2,356,779 | `6ab707f6529f724364a6c52a925cb63768d1915f357d6e0d496b6a43f6806d8a` |
| [Main UI, chunk 1](https://zalo-chat-static.zadn.vn/v1/lazy/1.eddd11e30e151903e701.js) | 15,932,045 | `f1f574c135e0016d0896910d12b7886cf65cb6b791bd9e813d4d7642e662fcba` |
| [UI dependencies, chunk 2](https://zalo-chat-static.zadn.vn/v1/lazy/2.213858f549d028d14c1a.js) | 1,952,179 | `e93c9cde6d9c4173c51a0706ab3c5be0ee0ee75f3d950ae5ced4a40f54c3b86c` |
| [Startup CSS](https://zalo-chat-static.zadn.vn/v1/web-startup.40966d2eb95f22a2700c.css) | 2,292,572 | `3cdfcecda8281c31a29c11892a2f7b28ace3cae796787927ba20773b86451528` |

The runtime lists the chunk filenames and CDN prefix; URLs above were derived from that public manifest. Downloads were kept temporarily under `/private/tmp/tin-nhan-zalo-*-public.*`; full provider bundles are not added to this repository.

Locations below are approximate **character offsets in UTF-8-decoded source**, not byte offsets or stable source locations. They are audit anchors for these exact hashes only.

## Source-backed selector candidates

| Purpose | Candidate | Evidence in main UI chunk 1 | What is still unknown |
| --- | --- | --- | --- |
| Conversation list root | `#conversationListId[data-id="div_TabMsg_ThrdChList"]` | Around 9,900,019: both attributes attached to the same list root | Presence in all account/layout/experiment variants |
| Conversation row | `.conv-item` under that root | Around 9,860,071: row class assembled with `conv-rel`, `selected`, and `pinned` | Rows may be virtualized; non-chat special rows exist |
| Conversation identity | Nearest ancestor `[anim-data-id]`, inside the same list root | Around 9,863,850: outer wrapper receives `anim-data-id=e.id`, and its row child receives the same logical ID | Non-chat pseudo-identifiers; identity persistence after reload and account changes |
| Conversation title | `.conv-item-title__name` inside the row | Around 9,838,096: title node rendered by the shared row layout | Decorative verification/group/E2EE elements may be adjacent; title is never identity |
| Legacy preview | `.conv-message` inside the row | Around 9,834,613: preview renderer | Sender prefix and draft content can be included |
| Current preview | `.z-conv-message` inside the row | Around 9,856,182; child `.z-conv-message__preview-message` contains the preview body | Feature-controlled variant; sender and draft semantics |
| Preview timestamp | `.preview-time` | Around 9,839,060: derived from `originTime` using localized formatting | Display text is not an exact epoch timestamp |
| Message root | `#messageView`, `#messageViewContainer`, `#messageViewScroll` | Around 646,725–648,497 | Empty states can also use `#messageView`; a root alone does not prove message access |
| Message bubble | `[data-component="bubble-message"]` | Around 111,436: rendered on `.chat-message.chat-message-v2` | Other bubble implementations and unsupported types |
| Plain text wrapper | `[data-component="message-text-content"]` | Around 2,601,993 | Includes only text-capable messages; not all attachments/system notices |
| Text body | `[data-component="text-container"]` | Around 2,602,160 | Rich text and embedded content need careful text extraction |
| Rich text body | `[data-component="rtf-container"]` | Around 13,759,369, with shared constant | Semantic normalization of mentions, links, inline images, formatting |
| Message time | `.card-send-time__sendTime` | Around 13,548,175 | May be suppressed, grouped, localized, or combined with status/TTL |
| Composer presence only | `#chatInput` | Around 5,312,125 | Presence must not be treated as permission or ability to send |

Shared constants around 59,600 map the `data-component` values used above. They are meaningful implementation identifiers, but are **not a published API contract**.

### Identity construction and separation

1. The conversation outer wrapper has `anim-data-id=e.id`. The inner row's React `id` prop is consumed by its renderer; do not assume `.conv-item.id` is populated. Read the closest matching ancestor only if it is contained in the verified conversation root. Its `data-id` value is an automation marker shared by rows and is **not** a unique conversation key.
2. Text rendering around 2,601,736 uses the constant `MSG_TEXT_CONTENT_ID_PREFIX` plus `msgObj.msgId`, unless `omitContentElementId` is enabled. The shared constant at approximately 33,567 is `mtc-`. Thus a nonempty `[data-component="text-container"][id^="mtc-"]` is a **server-message-ID candidate** based on the render source, not a guarantee that every message has it.
3. Bubble rendering around 92,193 uses `data.cliMsgId` (falling back to an empty string) with the prefix exported by module `CFkE`. That module, around 3,334,945, defines `bb_msg_id`. The resulting DOM ID is `bb_msg_id_<cliMsgId>`. Inner frames use `message-frame_<cliMsgId>`. Treat this as **client message identity**, distinct from `msgId`; reject empty suffixes.
4. The outer bubble's `me` class is conditional on the source's sent-by-me flag. That is evidence for a direction candidate, not evidence that sending succeeded. A visible outgoing bubble can be pending or failed.
5. Do not key by display name, snippet, row index, displayed time, or matching text. Scope any retained key by the app's account partition plus provider conversation identity and identity kind. Never expose or merge raw provider IDs across accounts.

Active selected-row identity alone does not prove that the message pane has finished switching to that conversation. A message connector needs evidence that selection and pane contents are coherent; reject ambiguous/transient observations. This is a blocker for reliable history extraction that does not block a standalone inbox-preview observation.

### Utility rows are not conversation destinations

The [shared constants bundle](https://zalo-chat-static.zadn.vn/v1/lazy/default-embed-render.2bae787e513bad5fdb28.js), at decoded-character offset approximately 42,402, defines `CONV_FILTER` with `MEDIA` mapped to `media_box` and `STRANGER` mapped to `stranger_box`. These are category identifiers. The main UI bundle uses `stranger_box` to choose a special avatar in the shared row renderer around 9,837,907. In the row component around 9,858,000–9,860,000, comparison with `CONV_FILTER.STRANGER` selects a category title, and comparisons with `CONV_FILTER.MEDIA` and `CONV_FILTER.STRANGER` exclude those entries from ordinary row cache-loading behavior. They can therefore appear inside the same `.conv-item` layout without being a single chat destination.

The same shared constants bundle exports `FAKE_CONVERSATION_ID`; its definition around 36,279 is:

| Constant member | Exact value | Treatment in the experimental parser |
| --- | --- | --- |
| `FRIEND_CENTER` | `-1000` | Skip utility row |
| `GROUP_CENTER` | `-2000` | Skip utility row |
| `NEW_GROUP` | `g` | Skip synthetic destination |
| `BROADCAST_CONV` | `b` | Skip synthetic destination |
| `NIGHT_CHAT` | `n` | Skip synthetic destination |

The row source around 9,859,500 explicitly handles `FAKE_CONVERSATION_ID.FRIEND_CENTER` separately when selecting a row. The startup UI around 447,564 also branches to a friend-center action for that value instead of ordinary conversation opening. These observations establish that a well-formed `anim-data-id` alone is insufficient to classify a row as a normal conversation.

Use exact-value exclusions for these seven source-backed identifiers; do **not** reject all IDs starting with `g`, use title-based exclusions, or assume all real IDs are numeric. Unknown identities still require live verification. Excluding a utility-only rendered window must not turn it into proof of an empty authenticated inbox.

### Password fields also represent PIN and app-lock states

In the [main UI bundle](https://zalo-chat-static.zadn.vn/v1/lazy/1.eddd11e30e151903e701.js), password input elements are rendered for several situations beyond account login:

- Around 818,302 and 11,764,620, four `.pin-input__item` elements use password inputs with one-character limits.
- Around 3,182,285–3,182,986, `.app-lock-popup__inputs` renders password fields for configuring or removing a passcode. The input IDs include `passcode` and `passcode-re`; automation markers distinguish the remove, new-passcode, and verification fields.
- Around 10,692,530, `.app-lock__main__input` renders a password input with ID `passcode` on an app-lock screen.

Therefore the presence of `input[type="password"]` is not sufficient evidence of a signed-out account. The research parser keeps a conservative stop-reading guard and reports `blocked` for this condition, without identifying it as `needs-login`. It neither reads the field value nor attempts to unlock, dismiss, or bypass the overlay. Positive login classification would need separate evidence.

### Preview semantics

The source selects between the legacy and current preview components using a feature flag. Both receive `shouldUseDraft`; the legacy renderer selects draft text when that flag is true. A preview can therefore be **a local unsent draft**, a system summary, a localized placeholder, or a truncated last-message preview. Preserve it as display preview text only. Do not record it as a delivered message, use it to advance a sync cursor, or overwrite the native page's draft.

Selecting a conversation, hovering a row, scrolling, or focusing its composer is not part of this read-only probe. The public row renderer includes click handlers for selection and hover-driven cache work, so a passive reader should not synthesize these events just to obtain more content.

## Bounded standalone probe

`scripts/research/zalo-dom-probe.mjs` exports `probeZaloDom`. It can be evaluated as `(${probeZaloDom.toString()})()` in the intended document; all helper closures are inside the function.

The probe:

- Requires the exact origin `https://chat.zalo.me`.
- Reads structure, known attributes and class presence only; returns counts/booleans and elapsed time.
- Uses IDs only in temporary sets to check duplicates; returns no identity values, message text, names, snippets, URLs, or drafts.
- Scans at most 3,000 element nodes per relevant root, retaining at most 40 row summaries and 60 bubble summaries.
- Adds no listener, observer, timer, fetch, click, key event, scroll, focus, DOM write, or persistent cache.
- Does not read cookies, local/session storage, IndexedDB, network responses, framework internals, account globals, input values, or contenteditable text.
- Calls the result `candidate-chat-structure`, never `authenticated` or `connected`.

Initial verification: the serialized function executed in an isolated synthetic DOM with no imported closures; fixture identity-presence checks passed; output contained neither private fixture text nor raw IDs; unsupported-origin and empty-DOM cases passed. Those checks verify probe mechanics only. The later, separate authenticated-inbox check is recorded below and still does not establish a complete Zalo connection.

## Implementation boundary

Can implement now:

- A bounded, account-scoped, read-only preview parser using the source-backed roots, row identity, title, and preview candidates above.
- Explicit capability states: unverified, recognized partial DOM, unsupported structure, and disconnected/unknown. Missing selectors must produce an honest unavailable state.
- Fixtures that cover duplicate/empty IDs, pseudo-rows, feature-controlled previews, drafts, absent roots, no DOM mutation, and output bounds.
- A one-shot manual diagnostics action or visible-view sampling through existing scheduling. No background eager loads or polling loops are justified by this research.

Needs user-authenticated-page verification before release:

- Presence and uniqueness of row identities on the actual current UI; account partition association; rows with unsupported pseudo-identifiers.
- Same identity before/after user-driven tab changes, normal reload, incoming updates, and return to a conversation. Preserve and verify drafts throughout.
- Two similarly named contacts and group/private conversations do not collide.
- Exact preview semantics and whether rendered rows are complete or virtualized.
- Evidence for message-pane/conversation correlation before persisting any message bodies.
- Coverage of pending, failed, edited, recalled, rich-text, attachment, and system messages; `msgId`/`cliMsgId` mapping and acknowledgement semantics.
- Real send behavior and user-controlled delivery verification. No send path is implemented or validated by this report.

A DOM connector continues to depend on the official web app running. It can improve presentation, but this research provides no evidence of lower RAM or CPU. Read-only previews are progress toward the unified UI; they are not enough to label a build as complete unified chat.

## Root follow-up: one authenticated rendered window

After the public-source review, the root agent executed the bounded parser in an
isolated world of the already authenticated 0.5.2 Zalo view, without clicking,
scrolling, focusing, reloading or sending. It observed 14 row structures; one
known utility row was excluded, leaving 13 conversation candidates with distinct
IDs and nonempty title elements. Two immediate parses matched. No conversation
was selected and no message/composer root was present, so history, pane binding,
send/ACK and stability across navigation remain unverified.

Only counts/booleans were returned from this check; no personal titles, previews
or ID values were written to diagnostics. Evidence: `outputs/zalo-live-evidence.json`.
The standalone structure probe still describes all 14 rendered rows, whereas
the parser's `loadedConversations` excludes utility rows. This is partial live
evidence for the inbox parser, not complete connector verification.
