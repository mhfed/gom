import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProviderTabs,
  openProviderTab,
  toggleProviderPin,
  closeProviderTab,
} from "../src/main/provider-tabs.ts";

const ids = [
  "zalo",
  "telegram",
  "messenger",
  "web_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
] as const;

test("legacy settings open the original providers without changing account pins", () => {
  assert.deepEqual(normalizeProviderTabs(undefined, [...ids]), {
    open: ["zalo", "telegram", "messenger"],
    pinned: [],
  });
  assert.deepEqual(
    normalizeProviderTabs({ open: [], pinned: ["zalo"] }, [...ids]),
    {
      open: [],
      pinned: [],
    },
  );
});

test("restoration preserves order while rejecting duplicates, foreign IDs and closed pins", () => {
  assert.deepEqual(
    normalizeProviderTabs(
      {
        open: [ids[3], "telegram", ids[3], "unknown", null],
        pinned: ["zalo", ids[3], ids[3], "unknown"],
      },
      [...ids],
    ),
    { open: [ids[3], "telegram"], pinned: [ids[3]] },
  );
  assert.deepEqual(normalizeProviderTabs({ open: {}, pinned: 42 }, [...ids]), {
    open: ["zalo", "telegram", "messenger"],
    pinned: [],
  });
});

test("activation reopens once, and pin/unpin keeps a provider open", () => {
  const tabs = {
    open: ["zalo"] as (typeof ids)[number][],
    pinned: [] as (typeof ids)[number][],
  };
  const opened = openProviderTab(tabs, ids[3]);
  assert.deepEqual(openProviderTab(opened, ids[3]), opened);
  assert.deepEqual(tabs, { open: ["zalo"], pinned: [] });
  const pinned = toggleProviderPin(tabs, ids[3]);
  assert.deepEqual(pinned, { open: ["zalo", ids[3]], pinned: [ids[3]] });
  assert.deepEqual(toggleProviderPin(pinned, ids[3]), {
    open: ["zalo", ids[3]],
    pinned: [],
  });
});

test("closing active chooses its left neighbor, then the right, then the library", () => {
  const tabs = {
    open: ["zalo", "telegram", "messenger"] as (typeof ids)[number][],
    pinned: ["telegram"] as (typeof ids)[number][],
  };
  assert.deepEqual(closeProviderTab(tabs, "telegram", "telegram"), {
    tabs: { open: ["zalo", "messenger"], pinned: [] },
    next: "zalo",
  });
  assert.equal(closeProviderTab(tabs, "zalo", "zalo").next, "telegram");
  assert.equal(
    closeProviderTab(tabs, "telegram", "messenger").next,
    "messenger",
  );
  assert.deepEqual(
    closeProviderTab({ open: ["zalo"], pinned: [] }, "zalo", "zalo"),
    {
      tabs: { open: [], pinned: [] },
      next: null,
    },
  );
  assert.deepEqual(tabs.open, ["zalo", "telegram", "messenger"]);
});
