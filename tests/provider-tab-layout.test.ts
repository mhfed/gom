import assert from "node:assert/strict";
import test from "node:test";
import { fitProviderTabs } from "../src/renderer/provider-tab-layout.ts";

const tab = (id: string, width = 120) => ({ id, width });
test("keeps every tab when the available width fits without an overflow control", () => {
  assert.deepEqual(fitProviderTabs([tab("a"), tab("b")], "a", 242), {
    visible: ["a", "b"],
    overflow: [],
  });
});
test("reserves space for overflow and promotes an active hidden tab", () => {
  assert.deepEqual(fitProviderTabs([tab("a"), tab("b"), tab("c")], "c", 280), {
    visible: ["a", "c"],
    overflow: ["b"],
  });
});
test("keeps the active tab visible among many compact pinned tabs", () => {
  const tabs = Array.from({ length: 10 }, (_, i) => tab(String(i), 34));
  const result = fitProviderTabs(tabs, "9", 178);
  assert.deepEqual(result.visible, ["0", "1", "2", "9"]);
  assert.equal(result.overflow.length, 6);
});
test("retains the active tab alone in a narrow area", () => {
  assert.deepEqual(fitProviderTabs([tab("a"), tab("b")], "b", 160), {
    visible: ["b"],
    overflow: ["a"],
  });
});
test("empty tabs and an inactive selection remain deterministic", () => {
  assert.deepEqual(fitProviderTabs([], "missing", 300), {
    visible: [],
    overflow: [],
  });
  assert.deepEqual(
    fitProviderTabs([tab("a"), tab("b"), tab("c")], "missing", 160),
    {
      visible: ["a"],
      overflow: ["b", "c"],
    },
  );
});
