import { test } from "node:test";
import assert from "node:assert/strict";
import * as layout from "../src/main/layout.ts";

test("returning a native page from another parent reapplies unchanged main bounds and visibility", () => {
  assert.equal(typeof layout.resetViewLayout, "function");
  const view = {
    visible: false,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    setVisible(value: boolean) {
      this.visible = value;
    },
    setBounds(value: ReturnType<typeof layout.providerBounds>) {
      this.bounds = value;
    },
  };
  layout.layoutViews([["zalo", view]], 1280, 800, "zalo", "service");
  view.setVisible(false);
  view.setBounds({ x: 0, y: 45, width: 400, height: 515 });
  layout.resetViewLayout(view);
  layout.layoutViews([["zalo", view]], 1280, 800, "zalo", "service");
  assert.equal(view.visible, true);
  assert.deepEqual(view.bounds, layout.providerBounds(1280, 800));
});
