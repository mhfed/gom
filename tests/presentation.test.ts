import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePresentation,
  sidebarWidth,
} from "../src/main/presentation.ts";
import { providerBounds, layoutViews } from "../src/main/layout.ts";

test("legacy settings gain presentation defaults without modifying account IDs", () => {
  const ids = ["zalo", "messenger", "telegram", "acc_custom"];
  assert.deepEqual(normalizePresentation(undefined, ids), {
    sidebarWidth: 224,
    theme: "platform",
    pinned: [],
  });
  const raw = {
    sidebarWidth: 280,
    theme: "dark",
    pinned: ["acc_custom", "zalo", "acc_custom", "unknown"],
    unrelated: "ignored",
  };
  assert.deepEqual(normalizePresentation(raw, ids), {
    sidebarWidth: 280,
    theme: "dark",
    pinned: ["acc_custom", "zalo"],
  });
  assert.deepEqual(ids, ["zalo", "messenger", "telegram", "acc_custom"]);
});
test("presentation clamps finite widths and rejects malformed theme/pins", () => {
  for (const width of [null, "250", NaN, Infinity, {}, []])
    assert.equal(sidebarWidth(width), 224);
  assert.equal(sidebarWidth(500), 300);
  assert.equal(sidebarWidth(12), 200);
  assert.equal(sidebarWidth(240.4), 240);
  assert.deepEqual(
    normalizePresentation(
      { sidebarWidth: 250, theme: "javascript", pinned: {} },
      ["zalo"],
    ),
    { sidebarWidth: 250, theme: "platform", pinned: [] },
  );
});
test("custom sidebar bounds and overlays preserve native viewport while hiding every provider", () => {
  assert.deepEqual(providerBounds(1024, 720, false, 280), {
    x: 280,
    y: 76,
    width: 744,
    height: 644,
  });
  assert.equal(providerBounds(1024, 720, true, 280).x, 72);
  const records = ["zalo", "telegram"].map((id) => ({
    id,
    visible: true,
    bounds: null as unknown,
  }));
  const views = records.map(
    (r) =>
      [
        r.id,
        {
          setVisible(v: boolean) {
            r.visible = v;
          },
          setBounds(v: unknown) {
            r.bounds = v;
          },
        },
      ] as const,
  );
  layoutViews(views, 1024, 720, false, "zalo", "command", 280);
  assert.ok(records.every((r) => !r.visible));
  assert.ok(
    records.every(
      (r) =>
        JSON.stringify(r.bounds) ===
        JSON.stringify({ x: 280, y: 76, width: 744, height: 644 }),
    ),
  );
});
