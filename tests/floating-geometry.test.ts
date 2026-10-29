import { test } from "node:test";
import assert from "node:assert/strict";
import {
  floatingBounds,
  moveBubbleBounds,
  snapBubbleBounds,
} from "../src/main/floating-geometry.ts";

test("new floating chat fits inside the chosen display work area", () => {
  const work = { x: 80, y: 30, width: 1200, height: 760 };
  assert.deepEqual(floatingBounds(work), {
    x: 868,
    y: 218,
    width: 400,
    height: 560,
  });
});

test("saved floating bounds stay on screen and shrink on a smaller display", () => {
  const work = { x: -800, y: 40, width: 800, height: 600 };
  const bounds = floatingBounds(work, {
    x: 1800,
    y: -100,
    width: 1000,
    height: 1000,
  });
  assert.deepEqual(bounds, { x: -788, y: 52, width: 776, height: 576 });
});

test("bubble snaps to either bottom corner without entering the menu bar or dock", () => {
  const work = { x: -1600, y: -100, width: 1600, height: 900 };
  assert.deepEqual(
    snapBubbleBounds({ x: -1500, y: -90, width: 72, height: 72 }, work),
    { x: -1588, y: 740, width: 48, height: 48 },
  );
  assert.deepEqual(
    snapBubbleBounds({ x: -50, y: 200, width: 72, height: 72 }, work),
    { x: -60, y: 740, width: 48, height: 48 },
  );
});

test("drag deltas are clamped to the work area and malformed values cannot move a bubble", () => {
  const work = { x: 0, y: 30, width: 1440, height: 840 };
  const current = { x: 1300, y: 700, width: 72, height: 72 };
  assert.deepEqual(moveBubbleBounds(current, { dx: -5000, dy: 5000 }, work), {
    x: 12,
    y: 786,
    width: 72,
    height: 72,
  });
  assert.deepEqual(
    moveBubbleBounds(
      current,
      { dx: Number.NaN, dy: Number.POSITIVE_INFINITY },
      work,
    ),
    current,
  );
});

test("very small work areas still contain both window and bubble bounds", () => {
  const work = { x: 10, y: 20, width: 60, height: 55 };
  for (const bounds of [
    floatingBounds(work),
    snapBubbleBounds({ x: 900, y: -200, width: 72, height: 72 }, work),
  ]) {
    assert.ok(bounds.x >= work.x && bounds.y >= work.y);
    assert.ok(bounds.x + bounds.width <= work.x + work.width);
    assert.ok(bounds.y + bounds.height <= work.y + work.height);
    assert.ok(bounds.width > 0 && bounds.height > 0);
  }
});
