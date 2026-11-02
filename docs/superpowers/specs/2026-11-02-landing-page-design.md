# Gom landing page

User direction: light background and Gom teal; delegate detailed design and implementation without further design questions (2026-11-02).

## Intent

Introduce Gom to Vietnamese desktop users juggling messaging services and accounts. The main action is downloading the appropriate Mac or Windows installer.

## Approach

Use a buildless static site in `website/`, hosted with GitHub Pages. A framework adds unnecessary build dependencies; Sites hosting was considered but the user explicitly selected GitHub Pages. Keep the desktop application's source and packaging untouched.

## Visual design

Revised after user feedback on 2026-11-02: the initial centered hero, italic serif, mint stage and rounded feature cards felt like a common AI template. Replace that composition with a restrained desktop-utility site. Use white #FFFFFF, ink #202725, gray #626965, neutral surface #F4F5F4, rules #DCE0DD and Gom teal #0B7A75 as a small accent. Typography is Helvetica Neue/Helvetica/Arial with normal proportions and medium weights; no serif or italic display. The asymmetrical introduction places a left-aligned factual headline beside direct downloads. A large plain app window follows. Features are divided content rows, downloads are simple OS rows and all prose describes actual usage. No decorative pills, floating endorsements, gradients, bento cards, stars or marketing claims. Use system fonts, local icons and no tracking or third-party runtime resources.

## Structure and behavior

Navigation → asymmetrical introduction and direct downloads → interactive provider window → supported platforms → feature rows (accounts, floating chat, private space, reminders and shelf) → simple three-step onboarding → OS download rows → installation FAQ → footer. Mobile navigation, keyboard-operable provider tabs, native FAQ disclosures and reduced-motion support. Download URLs reference verified release v0.8.3, not the older local README. Both installers remain reachable without JavaScript.

## Constraints and acceptance

Do not imply a unified message inbox or a proprietary messaging service. Example conversations must be labeled illustrative. Do not claim account synchronization, universal platform availability, encrypted session storage or signed installers. Explain macOS/Windows installation caveats in FAQ. Assets must work under `/gom/` and a root domain. Deploy only `website/`, never application outputs or profiles. Validate desktop/mobile layouts, all interactions, local paths, no-JS navigation/downloads, and Pages workflow. Verify the actual deployment if credentials and repository settings permit it; otherwise report the concrete remaining blocker.
