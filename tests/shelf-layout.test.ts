import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutViews } from "../src/main/layout.ts";
test("opening shelf reserves right-hand native pixels and closing restores the same view", () => {
  const view = {
    visible: false,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    setVisible(v: boolean) {
      this.visible = v;
    },
    setBounds(v: { x: number; y: number; width: number; height: number }) {
      this.bounds = v;
    },
  };
  layoutViews([["a", view]], 1280, 800, "a", "service", 340);
  assert.deepEqual(view.bounds, { x: 0, y: 52, width: 940, height: 748 });
  assert.equal(view.visible, true);
  layoutViews([["a", view]], 1280, 800, "a", "service", 0);
  assert.equal(view.bounds.width, 1280);
  assert.equal(view.visible, true);
});
test("small shelf surface hides native page and restores it after resize", () => {
  const view = {
    visible: false,
    setVisible(v: boolean) {
      this.visible = v;
    },
    setBounds() {},
  };
  layoutViews([["a", view]], 400, 640, "a", "service", 340);
  assert.equal(view.visible, false);
  layoutViews([["a", view]], 940, 640, "a", "service", 340);
  assert.equal(view.visible, true);
});
