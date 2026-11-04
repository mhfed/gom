import test from "node:test";
import assert from "node:assert/strict";
import { AutoClicker } from "../src/main/auto-click.ts";

test("clicks the selected point the requested number of times and stops", () => {
  const tasks: Array<() => void> = [];
  const clicks: Array<[number, number]> = [];
  const clicker = new AutoClicker({
    schedule: (fn) => {
      tasks.push(fn);
      return fn;
    },
    cancel: () => {},
    valid: () => true,
    click: (x, y) => clicks.push([x, y]),
    changed: () => {},
  });
  assert.equal(clicker.start({ x: 12, y: 34, interval: 100, count: 2 }), true);
  tasks.shift()!();
  tasks.shift()!();
  assert.deepEqual(clicks, [
    [12, 34],
    [12, 34],
  ]);
  assert.equal(clicker.running, false);
});

test("rejects invalid settings and stops when the target is no longer valid", () => {
  const tasks: Array<() => void> = [];
  let valid = true;
  let clicks = 0;
  const clicker = new AutoClicker({
    schedule: (fn) => {
      tasks.push(fn);
      return fn;
    },
    cancel: () => {},
    valid: () => valid,
    click: () => {
      clicks++;
    },
    changed: () => {},
  });
  assert.equal(clicker.start({ x: -1, y: 0, interval: 100, count: 3 }), false);
  assert.equal(clicker.start({ x: 1, y: 2, interval: 100, count: 3 }), true);
  valid = false;
  tasks.shift()!();
  assert.equal(clicks, 0);
  assert.equal(clicker.running, false);
});

test("stopping invalidates already queued callbacks", () => {
  const tasks: Array<() => void> = [];
  let clicks = 0;
  const clicker = new AutoClicker({
    schedule: (fn) => {
      tasks.push(fn);
      return fn;
    },
    cancel: () => {},
    valid: () => true,
    click: () => {
      clicks++;
    },
    changed: () => {},
  });
  clicker.start({ x: 1, y: 2, interval: 100, count: 2 });
  clicker.stop();
  tasks.shift()!();
  assert.equal(clicks, 0);
});
