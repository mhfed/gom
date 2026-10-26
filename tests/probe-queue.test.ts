import { test } from "node:test";
import assert from "node:assert/strict";
import { ProbeQueue } from "../src/main/probe-queue.ts";

test("show, switch and platform theme requests refresh after an in-flight background probe", async () => {
  const queue = new ProbeQueue(),
    view = {};
  let sampleTheme = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const samples: boolean[] = [];
  const work = async () => {
    samples.push(sampleTheme);
    await gate;
  };
  const pending = queue.run(view, work);
  sampleTheme = true;
  await queue.run(view, work, true);
  await queue.run(view, work, true);
  assert.deepEqual(samples, [false]);
  release();
  await pending;
  assert.deepEqual(samples, [false, true]);
});

test("ordinary polling skips duplicate work and another account is never blocked", async () => {
  const queue = new ProbeQueue(),
    first = {},
    second = {};
  let release!: () => void,
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const work = async () => {
    calls++;
    await gate;
  };
  const pending = queue.run(first, work);
  await queue.run(first, work);
  await queue.run(second, async () => {
    calls++;
  });
  assert.equal(calls, 2);
  release();
  await pending;
  assert.equal(calls, 2);
  await assert.rejects(
    queue.run(first, async () => {
      throw Error("navigation");
    }),
  );
  await queue.run(first, async () => {
    calls++;
  });
  assert.equal(calls, 3);
});
