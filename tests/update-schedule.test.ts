import test from "node:test";
import assert from "node:assert/strict";
import { UpdateSchedule } from "../src/main/update-schedule.ts";

function fixture(check: () => Promise<unknown> = async () => {}) {
  const timers = new Map<number, { run: () => void; delay: number }>();
  let calls = 0,
    id = 0;
  let clock = 0;
  const schedule = new UpdateSchedule(
    async () => {
      calls++;
      await check();
    },
    (run, delay) => {
      const key = ++id;
      timers.set(key, { run, delay });
      return () => {
        timers.delete(key);
      };
    },
    () => clock,
  );
  const fire = async () => {
    const [key, timer] = [...timers][0];
    timers.delete(key);
    timer.run();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return {
    schedule,
    timers,
    fire,
    calls: () => calls,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

test("automatic checks wait 30 seconds then 12 hours, with one timer", async () => {
  const f = fixture();
  f.schedule.configure(true);
  assert.equal(f.calls(), 0);
  assert.equal([...f.timers.values()][0].delay, 30_000);
  await f.fire();
  assert.equal(f.calls(), 1);
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 12 * 60 * 60 * 1000);
  f.schedule.stop();
  assert.equal(f.timers.size, 0);
});

test("disabled checks and sleep have no timer; wake observes opt-out", async () => {
  const f = fixture();
  f.schedule.configure(false);
  assert.equal(f.timers.size, 0);
  f.schedule.configure(true);
  f.schedule.suspend();
  assert.equal(f.timers.size, 0);
  f.schedule.resume();
  assert.equal([...f.timers.values()][0].delay, 30_000);
  f.schedule.configure(false);
  f.schedule.suspend();
  f.schedule.resume();
  assert.equal(f.timers.size, 0);
  assert.equal(f.calls(), 0);
});

test("finishing an old request cannot restart a disabled or stopped schedule", async () => {
  let finish!: () => void;
  const f = fixture(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  f.schedule.configure(true);
  await f.fire();
  assert.equal(f.timers.size, 0);
  f.schedule.configure(false);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.timers.size, 0);
  f.schedule.stop();
  f.schedule.configure(true);
  f.schedule.resume();
  assert.equal(f.timers.size, 0);
});

test("a failed check still waits 12 hours before retrying", async () => {
  const f = fixture(async () => {
    throw new Error("offline");
  });
  f.schedule.configure(true);
  await f.fire();
  assert.equal([...f.timers.values()][0].delay, 12 * 60 * 60 * 1000);
});

test("sleep and wake preserve the 12-hour due time instead of requesting after every wake", async () => {
  const f = fixture();
  f.schedule.configure(true);
  await f.fire();
  f.advance(60_000);
  f.schedule.suspend();
  f.advance(60_000);
  f.schedule.resume();
  assert.equal([...f.timers.values()][0].delay, 12 * 60 * 60 * 1000 - 120_000);
  f.schedule.suspend();
  f.advance(13 * 60 * 60 * 1000);
  f.schedule.resume();
  assert.equal([...f.timers.values()][0].delay, 30_000);
  assert.equal(f.calls(), 1);
});
