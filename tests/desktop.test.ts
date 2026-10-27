import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RecoveryPolicy } from "../src/main/recovery.ts";
import {
  defaultPreferences,
  normalizePreferences,
  restoreBounds,
  SettingsWriter,
} from "../src/main/preferences.ts";
import {
  notificationAllowed,
  validNotificationFrame,
  hasUnread,
} from "../src/main/notification-policy.ts";

test("recovery retries only failed providers with bounded backoff and never retries blocked navigation", () => {
  const r = new RecoveryPolicy();
  r.fail("zalo", "network", 0);
  assert.deepEqual(r.due(999, true), []);
  assert.deepEqual(r.due(1000, false), []);
  assert.deepEqual(r.due(1000, true), ["zalo"]);
  assert.deepEqual(r.due(1001, true), []);
  r.fail("zalo", "network", 1000);
  assert.deepEqual(r.due(3999, true), []);
  assert.deepEqual(r.due(4000, true), ["zalo"]);
  r.fail("zalo", "network", 4000);
  assert.deepEqual(r.due(14000, true), ["zalo"]);
  r.fail("zalo", "network", 14000);
  assert.deepEqual(r.due(999999, true), []);
  r.fail("messenger", "blocked", 0);
  assert.deepEqual(r.due(9999999, true), []);
  assert.equal(r.reason("telegram"), null);
});
test("successful stable recovery resets retry budget; wake never reloads healthy pages", () => {
  const r = new RecoveryPolicy();
  r.fail("telegram", "crashed", 0);
  r.due(1000, true);
  r.loaded("telegram", 1500);
  assert.deepEqual(r.due(5000, true), []);
  r.fail("telegram", "crashed", 5000);
  assert.deepEqual(r.due(6000, true), []);
  assert.deepEqual(r.due(8000, true), ["telegram"]);
  r.loaded("telegram", 8100);
  r.due(40000, true);
  r.fail("telegram", "network", 41000);
  assert.deepEqual(r.due(42000, true), ["telegram"]);
});
test("preferences reject malformed values without enabling startup or broadening permissions", () => {
  assert.deepEqual(normalizePreferences(null), defaultPreferences());
  const p = normalizePreferences({
    shortcut: "yes",
    paused: true,
    notifications: {
      zalo: "allow",
      messenger: "oops",
      telegram: "mute",
      evil: "allow",
    },
  });
  assert.equal(p.shortcut, false);
  assert.equal(p.paused, true);
  assert.deepEqual(p.notifications, {
    ...defaultPreferences().notifications,
    zalo: "allow",
    telegram: "mute",
  });
  assert.equal(
    normalizePreferences({ notifications: [] }).notifications.zalo,
    "ask",
  );
});
test("update checks default on for older settings and preserve an explicit opt-out", () => {
  assert.equal(defaultPreferences().updateChecks, true);
  assert.equal(normalizePreferences({}).updateChecks, true);
  assert.equal(
    normalizePreferences({ updateChecks: false }).updateChecks,
    false,
  );
  assert.equal(normalizePreferences({ updateChecks: true }).updateChecks, true);
  assert.equal(
    normalizePreferences({ updateChecks: "false" }).updateChecks,
    true,
  );
});
test("restored bounds stay visible after monitor removal and preserve a valid secondary screen position", () => {
  const displays = [
    { x: 0, y: 25, width: 1440, height: 875 },
    { x: 1440, y: 0, width: 1920, height: 1080 },
  ];
  assert.deepEqual(
    restoreBounds({ x: 1600, y: 50, width: 1000, height: 700 }, displays),
    { x: 1600, y: 50, width: 1000, height: 700 },
  );
  assert.deepEqual(
    restoreBounds({ x: 8000, y: -9000, width: 2000, height: 1500 }, [
      displays[0],
    ]),
    { x: 0, y: 25, width: 1440, height: 875 },
  );
  assert.deepEqual(
    restoreBounds({ x: NaN, y: Infinity, width: -50, height: "bad" }, [
      displays[0],
    ]),
    { x: 80, y: 42, width: 1280, height: 840 },
  );
});
test("serialized settings writes cannot overwrite a later preference snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "tin-nhan-settings-"));
  try {
    const path = join(root, "window.json");
    const writer = new SettingsWriter(path);
    await Promise.all([
      writer.write({ paused: false }),
      writer.write({ paused: true }),
      writer.write({ paused: false, shortcut: true }),
    ]);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
      paused: false,
      shortcut: true,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("notification permission requires owned main frame and exact allowed HTTPS origin; pause/mute win", () => {
  const p = defaultPreferences();
  assert.equal(notificationAllowed(p, "zalo"), false);
  p.notifications.zalo = "allow";
  assert.equal(notificationAllowed(p, "zalo"), true);
  p.paused = true;
  assert.equal(notificationAllowed(p, "zalo"), false);
  assert.equal(
    validNotificationFrame("zalo", "https://chat.zalo.me", true, true),
    true,
  );
  for (const [url, main, owned] of [
    ["https://chat.zalo.me.evil.com", true, true],
    ["https://chat.zalo.me", false, true],
    ["https://chat.zalo.me", true, false],
    ["http://chat.zalo.me", true, true],
    ["https://www.facebook.com", true, true],
  ] as const) {
    assert.equal(validNotificationFrame("zalo", url, main, owned), false);
  }
});
test("Dock unread indicator is presence only, ignores zero/unknown instead of mixing message and conversation totals", () => {
  assert.equal(hasUnread([{ count: null }, { count: 0 }]), false);
  assert.equal(hasUnread([{ count: 2 }, { count: 20 }]), true);
});
