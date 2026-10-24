# Tin Nhan0.5 — interactive design prototype

Approved scope: three screens (chat shell, CmdK switcher, account manager), each light/dark and expanded/collapsed. Warm ivory/graphite-green palette, compact typography, pinned accounts, resizable200–300px sidebar (224px default,72px collapsed).

Run from repo root:

```sh
node scripts/prototype-0.5/build.mjs
node scripts/prototype-0.5/check.mjs
```

Output: `../../outputs/TinNhan-0.5-prototype/index.html` is a portable single HTML file with embedded CSS/JS/platform logos. Open locally, or serve this output directory on loopback. QA uses installed Chromium1234 through existing playwright-core, captures12 variants plus940/1440/620px layouts and a contact sheet under `../prototype-0.5-check/`.

Interactions: three top preview tabs; light/dark button; sidebar collapse; drag edge/double-click reset/arrow-key width; Cmd/CtrlK or quick-search; account/action filtering, arrows/Enter/Escape; account switching; platform filtering; pin/unpin; per-account demo notification toggles; add/edit local demo account; chat search/unread filter; isolated per-account draft and simulated message. Refresh resets demo state.

Scope: all accounts/messages/attachments are invented. The provider chat is an illustrative backdrop, not an implementation or promise of a unified chat engine. No service/Keychain/real-account access, real message sending, remote requests, cookies or production userData. Theme and account actions modify preview memory only. No network fonts or packages added. Source is under scripts, excluded from production ASAR by the existing packaging rule. Actual Electron app remains0.4.1.

Visuals: official platform assets reused from src/renderer/logos; provenance retained there. The Mộc attachment cover and tn monogram are original code-drawn mock assets.
