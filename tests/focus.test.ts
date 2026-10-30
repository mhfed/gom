import { test } from "node:test";
import assert from "node:assert/strict";
import { FocusSchedule, normalizeFocus } from "../src/main/focus.ts";
import {
  defaultPreferences,
  normalizePreferences,
} from "../src/main/preferences.ts";
import {
  notificationAllowed,
  notificationsPaused,
} from "../src/main/notification-policy.ts";

const now = 1_800_000_000_000;
test("focus accepts only future finite integer deadlines within 24 hours and explicit audio choice", () => {
  for (const raw of [
    null,
    [],
    {},
    { endsAt: now },
    { endsAt: now - 1, muteAudio: false },
    { endsAt: Infinity, muteAudio: false },
    { endsAt: now + 0.5, muteAudio: false },
    { endsAt: now + 86_400_001, muteAudio: false },
    { endsAt: String(now + 1), muteAudio: false },
    { endsAt: now + 1, muteAudio: "false" },
  ])
    assert.equal(normalizeFocus(raw, now), undefined);
  assert.deepEqual(
    normalizeFocus({ endsAt: now + 86_400_000, muteAudio: false }, now),
    { endsAt: now + 86_400_000, muteAudio: false },
  );
});

function fixture() {
  let clock = now;
  const changes: unknown[] = [];
  const timers: { run(): void; delay: number; cancelled: boolean }[] = [];
  const schedule = new FocusSchedule(
    (value) => changes.push(value),
    (run, delay) => {
      const task = { run, delay, cancelled: false };
      timers.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    () => clock,
  );
  return {
    schedule,
    changes,
    timers,
    time: (value: number) => {
      clock = value;
    },
  };
}

test("focus expires exactly once without changing the deadline when an early timer fires", () => {
  const f = fixture();
  assert.equal(
    f.schedule.start({ endsAt: now + 60_000, muteAudio: true }),
    true,
  );
  f.time(now + 30_000);
  f.timers.at(-1)!.run();
  assert.equal(f.schedule.snapshot()?.endsAt, now + 60_000);
  f.time(now + 60_000);
  f.timers.at(-1)!.run();
  assert.equal(f.schedule.snapshot(), undefined);
  assert.deepEqual(f.changes, [
    { endsAt: now + 60_000, muteAudio: true },
    undefined,
  ]);
  f.schedule.refresh();
  assert.equal(f.changes.length, 2);
});

test("reschedule rejects invalid input, cancels stale timers and supports early stop", () => {
  const f = fixture();
  f.schedule.start({ endsAt: now + 1000, muteAudio: false });
  const first = f.timers[0];
  assert.equal(f.schedule.start({ endsAt: now, muteAudio: true }), false);
  assert.equal(f.schedule.snapshot()?.endsAt, now + 1000);
  f.schedule.start({ endsAt: now + 2000, muteAudio: true });
  assert.equal(first.cancelled, true);
  f.time(now + 1000);
  first.run();
  assert.equal(f.schedule.snapshot()?.endsAt, now + 2000);
  f.schedule.stop();
  f.timers.at(-1)!.run();
  assert.equal(f.schedule.snapshot(), undefined);
  assert.equal(f.changes.length, 3);
});

test("restore resumes an active focus, ignores expired state and refresh handles wake or forward clock jump", () => {
  const f = fixture();
  f.schedule.restore({ endsAt: now + 1000, muteAudio: true });
  assert.deepEqual(f.schedule.snapshot(), {
    endsAt: now + 1000,
    muteAudio: true,
  });
  const snapshot = f.schedule.snapshot()!;
  snapshot.endsAt = 0;
  assert.equal(f.schedule.snapshot()?.endsAt, now + 1000);
  f.time(now + 1500);
  f.schedule.refresh();
  assert.equal(f.schedule.snapshot(), undefined);
  f.schedule.restore({ endsAt: now + 1000, muteAudio: false });
  assert.equal(f.schedule.snapshot(), undefined);
});

test("a backwards clock jump retains the absolute deadline and quit cancels callbacks without clearing saved focus", () => {
  const f = fixture();
  f.schedule.start({ endsAt: now + 1000, muteAudio: false });
  f.time(now - 1000);
  f.timers.at(-1)!.run();
  assert.equal(f.schedule.snapshot()?.endsAt, now + 1000);
  assert.ok(f.timers.at(-1)!.delay > 0);
  f.schedule.dispose();
  const changes = f.changes.length;
  f.time(now + 2000);
  f.timers.at(-1)!.run();
  f.schedule.refresh();
  assert.equal(f.changes.length, changes);
  assert.equal(f.schedule.snapshot()?.endsAt, now + 1000);
});

test("focus and manual pause remain independent and expiry never enables a muted account", () => {
  const p = defaultPreferences();
  p.notifications.zalo = "allow";
  p.notifications.telegram = "mute";
  p.focus = { endsAt: Date.now() + 60_000, muteAudio: true };
  assert.equal(notificationsPaused(p), true);
  assert.equal(notificationAllowed(p, "zalo"), false);
  assert.equal(notificationAllowed(p, "telegram"), false);
  p.focus.endsAt = Date.now() - 1;
  assert.equal(notificationAllowed(p, "zalo"), true);
  assert.equal(notificationAllowed(p, "telegram"), false);
  p.paused = true;
  assert.equal(notificationsPaused(p), true);
  assert.equal(notificationAllowed(p, "zalo"), false);
});

test("old preferences remain compatible; only valid active focus is restored", () => {
  const focus = { endsAt: Date.now() + 100_000, muteAudio: false };
  assert.deepEqual(normalizePreferences({ focus }).focus, focus);
  assert.equal(
    normalizePreferences({ focus: { endsAt: 0, muteAudio: true } }).focus,
    undefined,
  );
  assert.deepEqual(normalizePreferences({}), defaultPreferences());
});
