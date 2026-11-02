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

test("compact slots fit eight platforms while reserving a readable active provider label", async () => {
  const { compactProviderWidth } =
    await import("../src/renderer/provider-tab-layout.ts");
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    width: compactProviderWidth(20, i === 0),
  }));
  const result = fitProviderTabs(items, "0", 350);
  assert.equal(result.visible.length, 8);
  assert.ok(items[0].width > items[1].width);
});
test("a long active custom provider stays visible and bounded when selection changes", async () => {
  const { compactProviderWidth } =
    await import("../src/renderer/provider-tab-layout.ts");
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    width: compactProviderWidth(i === 11 ? 800 : 70, i === 11),
  }));
  const result = fitProviderTabs(items, "11", 250);
  assert.ok(result.visible.includes("11"));
  assert.ok(result.overflow.length > 0);
  assert.ok(
    result.visible.reduce((sum, id) => sum + items[Number(id)].width, 0) +
      (result.visible.length - 1) * 2 +
      36 <=
      250,
  );
  assert.ok(Number.isFinite(compactProviderWidth(NaN, true)));
});
