import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { createResourcesUI } from "../src/renderer/resources.ts";
import type { AppState } from "../src/shared.ts";

test("hidden resource pane removes account IDs and names after membership changes", async () => {
  const { document, window } = parseHTML(
    await readFile(
      new URL("../src/renderer/index.html", import.meta.url),
      "utf8",
    ),
  );
  Object.defineProperty(document, "visibilityState", { value: "visible" });
  const originalDocument = globalThis.document,
    originalWindow = globalThis.window;
  Object.assign(globalThis, { document, window });
  Object.assign(window, { desktop: { resources: async () => ({ ok: true }) } });
  let activeTab = "resources";
  let state = {
    panel: "settings",
    commandOpen: false,
    accounts: [
      {
        id: "hidden",
        provider: "zalo",
        name: "PRIVATE_RESOURCE_NAME",
        archived: false,
      },
    ],
    providers: [{ id: "zalo", label: "Zalo" }],
    statuses: { hidden: "ready" },
    privateSpace: { lockVersion: 1 },
    resources: {
      open: true,
      sleeping: [],
      busy: [],
      blocked: {},
      snapshot: null,
      unavailable: false,
      error: "",
    },
  } as unknown as AppState;
  try {
    const ui = createResourcesUI({
      getState: () => state,
      activeTab: () => activeTab,
    });
    ui.sync(state);
    assert.ok(document.querySelector('[data-account="hidden"]'));
    activeTab = "appearance";
    state = { ...state, accounts: [] };
    ui.sync(state);
    assert.equal(
      document.querySelector('[data-account="hidden"]') === null,
      true,
    );
    assert.equal(
      document.body.textContent!.includes("PRIVATE_RESOURCE_NAME"),
      false,
    );
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
    });
  }
});
