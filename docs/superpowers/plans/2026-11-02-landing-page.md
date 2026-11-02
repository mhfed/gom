# Gom Landing Page Implementation Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. The user delegated detailed choices and asked to build immediately.

**Goal:** Deliver a polished Vietnamese Gom landing page ready for GitHub Pages.

**Architecture:** A self-contained `website/` folder with semantic HTML, CSS and a small progressive-enhancement script. A Pages Actions workflow publishes only that folder from main.

**Tech Stack:** HTML, CSS, browser JavaScript, existing local provider SVGs, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-02-landing-page-design.md`

## Global Constraints

- Preserve the desktop app and existing user changes.
- Use light Gom branding and verified v0.8.3 download assets.
- No dependencies, trackers or external assets at runtime.
- Work at both the root and `/gom/`; downloads work without JavaScript.

## Review Focus

- Narrow screens: no horizontal overflow; navigation and downloads remain usable.
- Keyboard navigation: visible focus and accessible tab selection.
- Failed/disabled JavaScript: complete content, links and FAQ remain usable.
- Content accuracy: private-space limitations and unsigned-installation guidance.
- Deployment: publish only website assets; main branch trigger and Pages permissions.

### Task 1: Build the static experience

**Files:** `website/index.html`, `website/styles.css`, `website/app.js`, `website/assets/*`.
**Interfaces:** HTML IDs/data attributes for provider preview and mobile navigation; all URLs are relative or absolute GitHub links.

- [x] Implement semantic content, responsive styling and local brand assets.
- [x] Implement provider switching, keyboard navigation and mobile menu.
- [x] Verify in browser at desktop/tablet/mobile sizes and without JavaScript. This presentation-only change is verified directly rather than adding implementation-mirroring unit tests.

### Task 2: Configure and verify Pages

**Files:** `.github/workflows/pages.yml`, `website/.nojekyll`, `docs/github-pages.md`, `README.md`.
**Interfaces:** Workflow artifact path `website`; published site `https://mhfed.github.io/gom/` if Pages is enabled.

- [x] Add Pages workflow and concise local/deployment instructions.
- [x] Verify JavaScript syntax, formatting, local links, download assets and workflow contract.
- [x] Attempt authorized publication using available GitHub access; confirm URL or document the exact blocker.
