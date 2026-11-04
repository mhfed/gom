import { test } from "node:test";
import assert from "node:assert/strict";
import { attachProviderViewToMain } from "../src/main/provider-view.ts";

test("returns a floating provider view to the main window before attaching it", () => {
  const view = {};
  const mainChildren: object[] = [];
  const floatingChildren = new Set([view]);
  const contentView = {
    children: mainChildren,
    addChildView(candidate: object) {
      if (floatingChildren.has(candidate)) throw Error("view-already-parented");
      mainChildren.push(candidate);
    },
  };
  let returned = 0;

  attachProviderViewToMain(
    "instagram",
    "instagram",
    () => {
      returned++;
      floatingChildren.delete(view);
      mainChildren.push(view);
    },
    contentView,
    view,
  );

  assert.equal(returned, 1);
  assert.deepEqual(mainChildren, [view]);
});
