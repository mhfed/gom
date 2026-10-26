import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePresentation,
  sidebarWidth,
} from "../src/main/presentation.ts";
import { layoutViews } from "../src/main/layout.ts";

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
test("settings and command overlays hide all provider views while retaining their full viewport", () => {
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
  for (const panel of ["settings", "command"]) {
    layoutViews(views, 1024, 720, "zalo", "service");
    assert.deepEqual(
      records.map((r) => r.visible),
      [true, false],
    );
    layoutViews(views, 1024, 720, "zalo", panel);
    assert.ok(records.every((r) => !r.visible));
    for (const record of records)
      assert.deepEqual(record.bounds, {
        x: 0,
        y: 52,
        width: 1024,
        height: 668,
      });
  }
  layoutViews(views, 1024, 720, "telegram", "service");
  assert.deepEqual(
    records.map((r) => r.visible),
    [false, true],
  );
  layoutViews(views, 1024, 720, "missing-account", "service");
  assert.ok(records.every((r) => !r.visible));
  assert.doesNotThrow(() =>
    layoutViews([], 1024, 720, "missing-account", "service"),
  );
});
