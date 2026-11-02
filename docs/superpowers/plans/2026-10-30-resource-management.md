# Resource Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task, with test-driven-development and one independent final review.

**Goal:** Show honest process-based resource estimates and safely unload/reopen chosen account pages.
**Architecture:** Pure metric projector and main-owned 4s sampler; separate persistent sleep store and serialized account lifecycle service. Narrow IPC exposes workspace-filtered rows, aggregate totals and guarded sleep/wake actions. Renderer owns only presentation and surface visibility.
**Tech Stack:** Existing Electron 45 / TypeScript / node:test / Playwright; no new dependencies.
**Spec:** `docs/superpowers/specs/2026-10-30-resource-management-design.md` (approved).

## Global Constraints

- Only manual sleep; preserve account partitions, settings, Focus, reminders, and pages of other accounts.
- Sample every 4s only while resource settings are visible; no DOM reads, raw PID/URL exposure, telemetry or history.
- Missing CPU/memory remains unknown; first CPU interval unknown; unique PIDs counted once, shared owners not attributed twice.
- Persist sleep across restart; failed flush/write or stale workspace/activation must leave the page running.
- Do not sleep an account with floating chat, popup, audio or active download, or during import/account mutations/quit.
- No release/package/install; source-only completion.

## Review Focus

- A wake/select arriving during confirmation or disk writes cancels sleep without later closing the selected page.
- Restart, workspace restoration, retries and sampling never recreate sleeping views.
- Hidden/private account identifiers and metric rows never cross workspace IPC boundaries.
- Missing/reused PIDs and first/failed sample cannot fabricate zero CPU or duplicate memory.
- Closed/hidden settings stop sampling; metadata updates must not cause idle DOM churn or overwrite form selection.

### Task 1: Metrics and sampling

**Files:** `src/resource-types.ts`, `src/main/resources.ts`, `tests/resources.test.ts`.
**Interfaces:** ResourceUsage `{memoryMiB:number|null,cpuPercent:number|null}`; ResourceSnapshot has totals/visible-account subtotal/rest and accountId-keyed measurements; ResourceSampler.configure(boolean), refresh(), dispose(); measurements are delivered through the changed callback. Input mappings are internal PID→owner sets; projector never exposes PIDs.

- [x] Write failing tests for unique/shared/missing metrics, reused PID creation time, first CPU sample, malformed measurements and sampler start/stop/error/restart.
- [x] Implement minimal projector and one cancelable 4s sampler; run unit tests RED→GREEN.

### Task 2: Persistent sleep and cancellation

**Files:** `src/main/account-sleep.ts`, `tests/account-sleep.test.ts`.
**Interfaces:** SleepStore.load(knownIds), has(id), snapshot(), set(id, asleep, valid, commit); AccountSleepService.sleep/wake(id, epoch), cancel(id), snapshot of busy state. Dependencies inject confirm, blockers, stable view identity, flush, close, activate, epoch and accessibility.

- [x] Write failing disk/transaction/lifecycle tests: persist/restart, invalid file, failed writes, canceled confirmation/write, activation racing sleep, blockers and wake through same account identity.
- [x] Implement separate `resource-sleep.json` state and serialized transitions. Revalidate after each await, prepare a temporary marker and synchronously publish marker/state/page after the final validation; never close on failed persistence.
- [x] Run tests RED→GREEN.

### Task 3: Integrate main lifecycle and resource UI

**Files:** `src/shared.ts`, `src/main/{main,preload,private-state}.ts`, `src/renderer/{resources,shell,command}.ts`, `src/renderer/{index.html,shell.css}`, `scripts/resources-check.mjs`.
**Interfaces:** DesktopBridge.resources(action:"surface"|"sleep"|"wake",data:{open?,accountId?,lockVersion}) returns AccountResult; AppState.resources includes filtered sleeping IDs, busy IDs, measurements/error, sample state.

- [x] Write isolated Electron fixture with safe synthetic pages and host-only metric/fs/dialog mocks; observe missing-feature RED before wiring.
- [x] Add guarded IPC, visibility-driven sampling, workspace scrub, download tracking, startup/recovery sleep exclusions and explicit wake-on-selection. Keep reminders and Focus behavior.
- [x] Add settings pane, honest totals/row labels, sorting and accessible manual controls, command entry; preserve controls and zero-mutation behavior across unchanged snapshots.
- [x] Verify fixture for sleep/wake, storage/drafts, restart, privacy/late callbacks, blockers, failed persistence, sampling lifecycle, current unknown values and 940/1280 light/dark UI.

### Task 4: Verify and deliver

**Files:** `README.md`, `docs/resource-management.md`, `docs/verification-resource-management.md`, this plan.

- [x] Run typecheck, whole unit suite, build, resource fixture, Focus/native-tabs/private/floating/reminder checks appropriate to lifecycle changes; record any baseline harness limitations.
- [x] One independent read-only review; actionable findings fixed with failing regression then green suite. No per-task delegation needed.
- [x] Save local verified commit; keep managed workspace and existing Focus work. No publish/install.

## Execution record

- User: “Duyệt, triển khai chức năng Quản lý tài nguyên theo thiết kế nhé.” Native inline execution authorized; no repeat approval.
- Isolated existing managed checkout at `08449e4`, detached HEAD. Source writes in this path require sandbox escalation; native worktree reused, no new worktree.
- Baseline before implementation: typecheck and 255/255 tests PASS in previous turn; no product changes since.
- Ruling: use a separate serialized sleep file instead of the general preferences writer, so sleep metadata writes do not overwrite unrelated settings; final guarded publication removes the need for compensation. Cost: one extra small local metadata file.

- Tasks 1–3: implemented. Resource projector/sampler, guarded persistent sleep service, private-state filtering, activity guards, lifecycle integration and resource UI. 13 Electron resource groups and 14 new unit tests pass; full suite 269/269 PASS.
- Final review: one independent reviewer, four Important findings fixed via observed RED→GREEN; details in verification-resource-management.md. No deferred minors.
- Ruling update: replaced asynchronous compensating writes with temp prepare + final valid check + synchronous rename/state/page commit. Cost: a single short synchronous metadata rename; prevents an invalid marker becoming durable and avoids rollback-write failure.
- User steering: “Giao diện tài nguyên hơi xấu ... cho trực quan hơn”. Reworked overview and rows into allocation bars, per-platform logos, status counts and compact sleep/wake controls; no additional approval needed for requested layout changes. Native screenshots inspected at 940/1280 in light/dark.
- Superdesign CLI preflight was denied by automatic approval review (external package download/execute). Continued safely with existing local frontend stack; no new dependency or external design upload.

- Final source verification: full 269/269 unit tests, typecheck, build, Prettier and diff whitespace checks passed. Resource 13 groups, Focus 18 groups, native tabs 16 checks and floating 12 groups passed. Private/reminder legacy native harnesses remain incomplete; paired HEAD builds reproduce unlock/hide instability. Exact results and limits are recorded in verification-resource-management.md rather than labeling all GUI checks green.
- Delivery: local source commit on `codex/resource-management`; preserve this managed workspace and the existing Focus commit. No merge, push, release or installer action.
