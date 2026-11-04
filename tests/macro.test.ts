import test from "node:test";
import assert from "node:assert/strict";
import { MacroRecorder, MacroPlayer } from "../src/main/macro.ts";

test("records ordered mouse and keyboard events with their delays", () => {
  let now = 1000;
  const recorder = new MacroRecorder(() => now);
  recorder.start();
  now += 100;
  recorder.record({
    type: "mouseDown",
    x: 20,
    y: 30,
    button: "left",
    clickCount: 1,
  });
  now += 200;
  recorder.record({ type: "keyDown", keyCode: "A", modifiers: [] });
  assert.deepEqual(recorder.finish(), [
    {
      delay: 100,
      event: { type: "mouseDown", x: 20, y: 30, button: "left", clickCount: 1 },
    },
    { delay: 200, event: { type: "keyDown", keyCode: "A", modifiers: [] } },
  ]);
});

test("plays recorded events in order and stops stale callbacks", () => {
  const pending: Array<{ fn: () => void; delay: number }> = [];
  const sent: string[] = [];
  let valid = true;
  const player = new MacroPlayer({
    schedule: (fn, delay) => {
      const t = { fn, delay };
      pending.push(t);
      return t;
    },
    cancel: () => {},
    valid: () => valid,
    send: (e) => sent.push(e.type),
    changed: () => {},
  });
  assert.equal(
    player.start(
      [
        { delay: 30, event: { type: "keyDown", keyCode: "A", modifiers: [] } },
        { delay: 40, event: { type: "keyUp", keyCode: "A", modifiers: [] } },
      ],
      2,
    ),
    true,
  );
  assert.equal(pending[0].delay, 30);
  pending.shift()!.fn();
  assert.equal(pending[0].delay, 40);
  pending.shift()!.fn();
  valid = false;
  pending.shift()!.fn();
  assert.deepEqual(sent, ["keyDown", "keyUp"]);
  assert.equal(player.running, false);
  player.start(
    [{ delay: 0, event: { type: "keyDown", keyCode: "A", modifiers: [] } }],
    1,
  );
  player.stop();
  pending.shift()!.fn();
  assert.deepEqual(sent, ["keyDown", "keyUp"]);
});

test("encrypted store survives restart, separates spaces, and respects revoked saves", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { MacroStore } = await import("../src/main/macro-store.ts");
  const path = await mkdtemp(join(tmpdir(), "gom-macro-test-"));
  const codec = {
    encrypt: async (value: string) => Buffer.from(value).toString("base64"),
    decrypt: async (value: string) => Buffer.from(value, "base64").toString(),
  };
  const macro = {
    accountId: "zalo",
    url: "https://chat.zalo.me/",
    width: 800,
    height: 600,
    steps: [
      {
        delay: 100,
        event: { type: "keyDown" as const, keyCode: "A", modifiers: [] },
      },
    ],
  };
  try {
    const store = new MacroStore(path, codec);
    assert.equal(await store.save("normal", macro, () => true), true);
    assert.equal(
      (await readFile(join(path, "normal.json"), "utf8")).includes("zalo"),
      false,
    );
    assert.deepEqual(await new MacroStore(path, codec).load("normal"), macro);
    assert.equal(await store.load("private"), null);
    assert.equal(
      await store.save(
        "normal",
        { ...macro, accountId: "secret" },
        () => false,
      ),
      false,
    );
    assert.deepEqual(await store.load("normal"), macro);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});

test("a space change during encryption cancels publication and preserves the prior macro", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { MacroStore } = await import("../src/main/macro-store.ts");
  const dir = await mkdtemp(join(tmpdir(), "gom-macro-race-"));
  let release: (() => void) | undefined;
  let pause = false;
  let valid = true;
  const codec = {
    encrypt: async (text: string) => {
      if (pause)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return Buffer.from(text).toString("base64");
    },
    decrypt: async (text: string) => Buffer.from(text, "base64").toString(),
  };
  const macro = {
    accountId: "zalo",
    url: "https://chat.zalo.me/",
    width: 800,
    height: 600,
    steps: [
      {
        delay: 0,
        event: {
          type: "mouseDown" as const,
          x: 1,
          y: 1,
          button: "left" as const,
          clickCount: 1,
        },
      },
    ],
  };
  try {
    const store = new MacroStore(dir, codec);
    await store.save("private", macro, () => true);
    pause = true;
    const pending = store.save(
      "private",
      { ...macro, accountId: "other" },
      () => valid,
    );
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
    valid = false;
    release();
    assert.equal(await pending, false);
    assert.deepEqual(await store.load("private"), macro);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recording rejects events after its two-minute time limit and 500-step cap", () => {
  let now = 0;
  const recorder = new MacroRecorder(() => now);
  const click = {
    type: "mouseDown" as const,
    x: 1,
    y: 1,
    button: "left" as const,
    clickCount: 1,
  };
  recorder.start();
  now = 120001;
  assert.equal(recorder.record(click), false);
  recorder.start();
  for (let i = 0; i < 500; i++) assert.equal(recorder.record(click), true);
  assert.equal(recorder.record(click), false);
});

test("multiple macro slots persist independently and deleting a slot keeps the others", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { MacroStore } = await import("../src/main/macro-store.ts");
  const dir = await mkdtemp(join(tmpdir(), "gom-macro-slots-"));
  const codec = {
    encrypt: async (v: string) => Buffer.from(v).toString("base64"),
    decrypt: async (v: string) => Buffer.from(v, "base64").toString(),
  };
  const macro = {
    accountId: "zalo",
    url: "https://chat.zalo.me/",
    width: 800,
    height: 600,
    steps: [
      {
        delay: 0,
        event: {
          type: "mouseDown" as const,
          x: 1,
          y: 1,
          button: "left" as const,
          clickCount: 1,
        },
      },
    ],
  };
  try {
    const store = new MacroStore(dir, codec);
    assert.equal(await store.save("normal", macro, () => true, 1), true);
    assert.equal(
      await store.save(
        "normal",
        { ...macro, accountId: "telegram" },
        () => true,
        2,
      ),
      true,
    );
    assert.equal((await store.load("normal", 1))?.accountId, "zalo");
    assert.equal((await store.load("normal", 2))?.accountId, "telegram");
    assert.equal(await store.remove("normal", 1, () => false), false);
    assert.equal(await store.remove("normal", 2, () => true), true);
    assert.equal(await store.load("normal", 2), null);
    assert.equal((await store.load("normal", 1))?.accountId, "zalo");
    await assert.rejects(() => store.load("normal", 999));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validates drag and scrolling steps and rejects incomplete drags", async () => {
  const { validMacro } = await import("../src/main/macro.ts");
  const base = {
    accountId: "zalo",
    url: "https://chat.zalo.me/",
    width: 800,
    height: 600,
  };
  const drag = [
    { delay: 0, event: { type: "mousePress", x: 10, y: 20 } },
    { delay: 20, event: { type: "mouseMove", x: 30, y: 40 } },
    { delay: 20, event: { type: "mouseRelease", x: 30, y: 40 } },
    {
      delay: 30,
      event: { type: "mouseWheel", x: 50, y: 60, deltaX: 0, deltaY: -100 },
    },
  ];
  assert.equal(validMacro({ ...base, steps: drag }), true);
  assert.equal(validMacro({ ...base, steps: drag.slice(0, 2) }), false);
  assert.equal(validMacro({ ...base, steps: [drag[2]] }), false);
});

test("wheel data from a page becomes bounded native scroll input", async () => {
  const { macroWheelEvent } = await import("../src/main/macro.ts");
  assert.deepEqual(
    macroWheelEvent(
      { x: 30, y: 40, deltaX: 0, deltaY: 2, deltaMode: 1 },
      800,
      600,
    ),
    { type: "mouseWheel", x: 30, y: 40, deltaX: 0, deltaY: -32 },
  );
  assert.equal(
    macroWheelEvent(
      { x: 800, y: 0, deltaX: 0, deltaY: 1, deltaMode: 0 },
      800,
      600,
    ),
    null,
  );
  assert.equal(
    macroWheelEvent(
      { x: 30, y: 40, deltaX: 0, deltaY: Infinity, deltaMode: 0 },
      800,
      600,
    ),
    null,
  );
});

test("macro timing edits preserve actions and validate every delay", async () => {
  const { withMacroDelays } = await import("../src/main/macro.ts");
  const macro = {
    accountId: "zalo",
    url: "https://chat.zalo.me/",
    width: 800,
    height: 600,
    steps: [
      {
        delay: 100,
        event: { type: "keyDown" as const, keyCode: "A", modifiers: [] },
      },
      {
        delay: 200,
        event: {
          type: "mouseDown" as const,
          x: 20,
          y: 40,
          button: "left" as const,
          clickCount: 1,
        },
      },
    ],
  };
  const updated = withMacroDelays(macro, [250, 1500]);
  assert.deepEqual(
    updated?.steps.map((s) => s.delay),
    [250, 1500],
  );
  assert.deepEqual(
    updated?.steps.map((s) => s.event),
    macro.steps.map((s) => s.event),
  );
  assert.deepEqual(
    macro.steps.map((s) => s.delay),
    [100, 200],
  );
  for (const bad of [[0], [0, -1], [0, 1.5], [43200001, 43200000], [NaN, 0]])
    assert.equal(withMacroDelays(macro, bad), null);
});

test("macro accepts a user-selected repeat count up to 10000", () => {
  const pending: Array<() => void> = [];
  const player = new MacroPlayer({
    schedule: (fn) => {
      pending.push(fn);
      return fn;
    },
    cancel: () => {},
    valid: () => true,
    send: () => {},
    changed: () => {},
  });
  const steps = [
    {
      delay: 0,
      event: { type: "keyDown" as const, keyCode: "A", modifiers: [] },
    },
  ];
  assert.equal(player.start(steps, 250), true);
  player.stop();
  assert.equal(player.start(steps, 10001), false);
  assert.equal(player.start(steps, 1.5), false);
});
