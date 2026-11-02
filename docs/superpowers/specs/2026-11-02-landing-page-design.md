# Gom landing page

User direction: light background and Gom teal; delegate detailed design and implementation without further design questions (2026-11-02).

## Intent

Introduce Gom to Vietnamese desktop users juggling messaging services and accounts. The main action is downloading the appropriate Mac or Windows installer.

## Approach

Use a buildless static site in `website/`, hosted with GitHub Pages. A framework adds unnecessary build dependencies; Sites hosting was considered but the user explicitly selected GitHub Pages. Keep the desktop application's source and packaging untouched.

## Visual design

Use the existing Gom mark and palette: teal #0B7A75, mint #9DE4CF, ivory #F7F7F2, ink #172E2C, muted #617775, white #FFFFFF. Large rounded sans-serif headings, restrained serif emphasis, generous whitespace and a mint stage with a functional, explicitly illustrative product preview form the identity. Use system fonts, local icons and no tracking or third-party runtime resources.

## Structure and behavior

Navigation → hero and download actions → interactive provider preview → supported platforms → feature layouts (accounts, floating chat, private space, reminders and shelf) → three-step onboarding → download panel → installation FAQ → footer. Mobile navigation, keyboard-operable provider tabs, native FAQ disclosures and reduced-motion support. Download URLs reference verified release v0.8.3, not the older local README. Both installers remain reachable without JavaScript.

## Constraints and acceptance

Do not imply a unified message inbox or a proprietary messaging service. Example conversations must be labeled illustrative. Do not claim account synchronization, universal platform availability, encrypted session storage or signed installers. Explain macOS/Windows installation caveats in FAQ. Assets must work under `/gom/` and a root domain. Deploy only `website/`, never application outputs or profiles. Validate desktop/mobile layouts, all interactions, local paths, no-JS navigation/downloads, and Pages workflow. Verify the actual deployment if credentials and repository settings permit it; otherwise report the concrete remaining blocker.
