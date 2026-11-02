# Gom landing page

User direction: light background and Gom teal; delegate detailed design and implementation without further design questions (2026-11-02).

## Intent

Introduce Gom to Vietnamese desktop users juggling messaging services and accounts. The main action is downloading the appropriate Mac or Windows installer.

## Approach

Use a buildless static site in `website/`, hosted with GitHub Pages. A framework adds unnecessary build dependencies; Sites hosting was considered but the user explicitly selected GitHub Pages. Keep the desktop application's source and packaging untouched.

## Visual design

Latest direction after two user reviews on 2026-11-02: the first centered mint/italic-serif/bento page felt templated, while the all-white text-row version felt too plain for a landing page. Keep Helvetica Neue/Helvetica/Arial and natural copy, but give the product a more developed visual presentation.

Use a split hero with a working app preview on a deep teal #174E45 surface. Follow with a supported-platform roster, an account-switcher story with a native UI illustration, a contrasting dark chat-float story showing a document and floating conversation, then three compact utility illustrations. Keep most of the page white; use teal to establish hierarchy, no gradients, display serif, stars, invented testimonials or statistics. Download requirements and supporting links must meet normal-text contrast; use #536C50 and #526A50 on #E7EEE8.

## Structure and behavior

Navigation → split hero with direct Mac/Windows downloads and interactive provider window → supported platforms → two illustrated product-use stories → private space/reminders/shelf → onboarding → download band → installation FAQ → footer. Retain mobile navigation, keyboard-operable provider tabs, native FAQ disclosures and reduced-motion support. Chat-float demo can open from either hero or the feature story and returns focus to its invoking control. All sample content is explicitly illustrative. Download URLs reference verified release v0.8.3. Both installers remain reachable without JavaScript.

## Constraints and acceptance

Do not imply a unified message inbox or a proprietary messaging service. Example conversations must be labeled illustrative. Do not claim account synchronization, universal platform availability, encrypted session storage or signed installers. Explain macOS/Windows installation caveats in FAQ. Assets must work under `/gom/` and a root domain. Deploy only `website/`, never application outputs or profiles. Validate desktop/mobile layouts, all interactions, local paths, no-JS navigation/downloads, and Pages workflow. Verify the actual deployment if credentials and repository settings permit it; otherwise report the concrete remaining blocker.
