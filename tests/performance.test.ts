import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { StatePublisher } from "../src/main/state-publisher.ts";
import { limitBackgroundWarmup } from "../src/main/background-throttling.ts";
import { layoutViews } from "../src/main/layout.ts";

test("publication suppresses identical snapshots but sends nested changes and explicit zero", () => {
  const state = { active: "a", unread: { a: null as number | null } };
  const sent: unknown[] = [];
  const publisher = new StatePublisher(
    () => state,
    (value) => sent.push(structuredClone(value)),
  );
  publisher.publish();
  publisher.publish();
  state.unread = { a: null };
  publisher.publish();
  assert.equal(sent.length, 1);
  state.unread.a = 0;
  publisher.publish();
  state.active = "b";
  publisher.publish();
  assert.deepEqual(sent, [
    { active: "a", unread: { a: null } },
    { active: "a", unread: { a: 0 } },
    { active: "b", unread: { a: 0 } },
  ]);
});

test("poll results coalesce without postponing delivery and user actions flush immediately", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = { a: 0, b: 0 };
  const sent: unknown[] = [];
  const publisher = new StatePublisher(
    () => state,
    (value) => sent.push(structuredClone(value)),
  );
  publisher.publish();
  state.a = 1;
  publisher.schedule();
  t.mock.timers.tick(20);
  state.b = 2;
  publisher.schedule();
  t.mock.timers.tick(5);
  assert.deepEqual(sent.at(-1), { a: 1, b: 2 });
  assert.equal(sent.length, 2);
  state.a = 3;
  publisher.schedule();
  publisher.publish();
  assert.equal(sent.length, 3);
  t.mock.timers.tick(100);
  assert.equal(sent.length, 3);
  state.a = 4;
  publisher.schedule();
  publisher.cancel();
  t.mock.timers.tick(100);
  assert.equal(sent.length, 3);
});

test("failed state delivery can be retried with the same snapshot", () => {
  let broken = true,
    sent = 0;
  const publisher = new StatePublisher(
    () => ({ a: 1 }),
    () => {
      if (broken) throw Error("renderer unavailable");
      sent++;
    },
  );
  assert.throws(() => publisher.publish());
  broken = false;
  publisher.publish();
  assert.equal(sent, 1);
});

test("command acknowledgement restores an optimistic control even when authoritative state is unchanged", () => {
  const state = { shortcut: false, notice: "shortcut unavailable" };
  let checkbox = false,
    sends = 0;
  const publisher = new StatePublisher(
    () => state,
    (value) => {
      checkbox = value.shortcut;
      sends++;
    },
  );
  publisher.publish();
  checkbox = true; // Native checkbox changes before the command is accepted.
  publisher.publish(true); // OS rejects the same shortcut again.
  assert.equal(checkbox, false);
  assert.equal(sends, 2);
  publisher.publish();
  assert.equal(sends, 2);
});

class BackgroundContents extends EventEmitter {
  destroyed = false;
  throttled = false;
  writes = 0;
  isDestroyed() {
    return this.destroyed;
  }
  getBackgroundThrottling() {
    return this.throttled;
  }
  setBackgroundThrottling(value: boolean) {
    this.throttled = value;
    this.writes++;
  }
}

test("login or unrecognized pages stop bypassing background throttling after warmup", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contents = new BackgroundContents();
  limitBackgroundWarmup(contents);
  t.mock.timers.tick(29_999);
  assert.equal(contents.throttled, false);
  t.mock.timers.tick(1);
  assert.equal(contents.throttled, true);
  assert.equal(contents.listenerCount("destroyed"), 0);
});

test("authentication ends warmup early and destroyed views release the pending timer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const authenticated = new BackgroundContents();
  const finish = limitBackgroundWarmup(authenticated);
  finish();
  finish();
  assert.equal(authenticated.throttled, true);
  const archived = new BackgroundContents();
  limitBackgroundWarmup(archived);
  archived.destroyed = true;
  archived.emit("destroyed");
  t.mock.timers.tick(60_000);
  assert.equal(authenticated.writes, 1);
  assert.equal(archived.writes, 0);
  assert.equal(archived.listenerCount("destroyed"), 0);
});

test("unchanged layout avoids native writes while switch, resize and new views still update", () => {
  const makeView = () => ({
    visible: [] as boolean[],
    bounds: [] as unknown[],
    setVisible(value: boolean) {
      this.visible.push(value);
    },
    setBounds(value: unknown) {
      this.bounds.push(value);
    },
  });
  const a = makeView(),
    b = makeView();
  const views = [
    ["a", a],
    ["b", b],
  ] as const;
  layoutViews(views, 1024, 720, "a", "service");
  layoutViews(views, 1024, 720, "a", "service");
  assert.equal(a.bounds.length, 1);
  assert.equal(a.visible.length, 1);
  assert.equal(b.bounds.length, 1);
  assert.equal(b.visible.length, 1);
  assert.deepEqual(a.bounds[0], { x: 0, y: 64, width: 1024, height: 656 });
  layoutViews(views, 1024, 720, "b", "service");
  assert.deepEqual(a.visible, [true, false]);
  assert.deepEqual(b.visible, [false, true]);
  assert.equal(b.bounds.length, 1);
  layoutViews(views, 1100, 800, "b", "service");
  assert.equal(a.bounds.length, 2);
  assert.equal(b.bounds.length, 2);
  assert.deepEqual(b.bounds[1], { x: 0, y: 64, width: 1100, height: 736 });
  assert.deepEqual(b.visible, [false, true]);
  layoutViews(views, 1100, 800, "b", "settings");
  assert.deepEqual(b.visible, [false, true, false]);
  layoutViews(views, 1100, 800, "b", "settings");
  assert.equal(a.bounds.length, 2);
  assert.equal(b.bounds.length, 2);
  assert.deepEqual(a.visible, [true, false]);
  assert.deepEqual(b.visible, [false, true, false]);
  const restored = makeView();
  layoutViews([["b", restored]], 1100, 800, "b", "service");
  assert.equal(restored.bounds.length, 1);
  assert.deepEqual(restored.visible, [true]);
});
