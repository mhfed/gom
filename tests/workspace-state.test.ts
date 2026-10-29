import { test } from "node:test";
import assert from "node:assert/strict";
import type { Account } from "../src/shared.ts";
import { normalizeWorkspaceNavigation } from "../src/main/workspace-state.ts";

const accounts: Account[] = [
  {
    id: "normal-zalo",
    provider: "zalo",
    name: "Normal",
    avatar: "N",
    archived: false,
  },
  {
    id: "private-zalo",
    provider: "zalo",
    name: "Private",
    avatar: "P",
    archived: false,
    private: true,
  },
  {
    id: "private-web",
    provider: "web_private",
    name: "Private web",
    avatar: "P",
    archived: false,
    private: true,
  },
  {
    id: "normal-telegram",
    provider: "telegram",
    name: "Other",
    avatar: "N",
    archived: false,
  },
  {
    id: "private-archived",
    provider: "gmail",
    name: "Archived",
    avatar: "A",
    archived: true,
    private: true,
  },
];

test("empty private workspace has no default accounts or provider tabs", () => {
  const nav = normalizeWorkspaceNavigation(
    undefined,
    accounts.filter((a) => !a.private),
    true,
  );
  assert.equal(nav.active, "");
  assert.deepEqual(nav.providerTabs, { open: [], pinned: [] });
  assert.deepEqual(nav.lastAccounts, {});
  assert.equal(nav.panel, "welcome");
});

test("defaults open only providers with nonarchived accounts in that workspace including custom sites", () => {
  const normal = normalizeWorkspaceNavigation(undefined, accounts, false);
  const privateNav = normalizeWorkspaceNavigation(undefined, accounts, true);
  assert.deepEqual(normal.providerTabs.open, ["zalo", "telegram"]);
  assert.deepEqual(privateNav.providerTabs.open, ["zalo", "web_private"]);
  assert.equal(normal.active, "normal-zalo");
  assert.equal(privateNav.active, "private-zalo");
});

test("legacy navigation is split by workspace without sharing same-provider account selection", () => {
  const raw = {
    active: "private-web",
    providerTabs: {
      open: ["telegram", "web_private", "zalo", "gmail", "missing", "zalo"],
      pinned: ["web_private", "telegram"],
    },
    presentation: {
      sidebarWidth: 271,
      theme: "dark",
      pinned: ["normal-zalo", "private-web", "private-archived"],
    },
    lastAccounts: {
      zalo: "normal-zalo",
      web_private: "private-web",
      gmail: "private-archived",
    },
    panel: "service",
    collapsed: true,
  };
  const normal = normalizeWorkspaceNavigation(raw, accounts, false);
  const privateNav = normalizeWorkspaceNavigation(raw, accounts, true);
  assert.deepEqual(normal.providerTabs, {
    open: ["telegram", "zalo"],
    pinned: ["telegram"],
  });
  assert.deepEqual(privateNav.providerTabs, {
    open: ["web_private", "zalo"],
    pinned: ["web_private"],
  });
  assert.equal(normal.active, "normal-telegram");
  assert.equal(privateNav.active, "private-web");
  assert.deepEqual(normal.lastAccounts, { zalo: "normal-zalo" });
  assert.deepEqual(privateNav.lastAccounts, { web_private: "private-web" });
  assert.deepEqual(normal.presentation.pinned, ["normal-zalo"]);
  assert.deepEqual(privateNav.presentation.pinned, [
    "private-web",
    "private-archived",
  ]);
  assert.equal(privateNav.presentation.theme, "dark");
  assert.equal(privateNav.presentation.sidebarWidth, 271);
  assert.equal(privateNav.panel, "service");
  assert.equal(privateNav.collapsed, true);
  normal.providerTabs.open.push("gmail");
  assert.equal(raw.providerTabs.open.filter((id) => id === "gmail").length, 1);
  assert.equal(privateNav.providerTabs.open.includes("gmail"), false);
});

test("explicitly closed tabs remain closed and invalidate service selection", () => {
  const nav = normalizeWorkspaceNavigation(
    {
      active: "private-zalo",
      providerTabs: { open: [], pinned: ["zalo"] },
      panel: "service",
    },
    accounts,
    true,
  );
  assert.deepEqual(nav.providerTabs, { open: [], pinned: [] });
  assert.equal(nav.active, "");
  assert.equal(nav.panel, "welcome");
  for (const panel of ["settings", "providers", "welcome"]) {
    assert.equal(
      normalizeWorkspaceNavigation({ ...nav, panel }, accounts, true).panel,
      panel,
    );
  }
});

test("malformed and stale saved navigation cannot retain another workspace or archived account", () => {
  const nav = normalizeWorkspaceNavigation(
    {
      active: "private-archived",
      providerTabs: {
        open: ["gmail", "zalo", 42],
        pinned: ["gmail", "zalo", "zalo"],
      },
      lastAccounts: {
        zalo: "normal-zalo",
        gmail: "private-archived",
        telegram: "private-zalo",
      },
      presentation: {
        pinned: ["private-archived", "unknown", "normal-zalo"],
        sidebarWidth: Infinity,
        theme: "bad",
      },
      panel: "unknown",
      collapsed: "true",
    },
    accounts,
    true,
  );
  assert.equal(nav.active, "private-zalo");
  assert.deepEqual(nav.providerTabs, { open: ["zalo"], pinned: ["zalo"] });
  assert.deepEqual(nav.lastAccounts, {});
  assert.deepEqual(nav.presentation, {
    pinned: ["private-archived"],
    sidebarWidth: 224,
    theme: "platform",
  });
  assert.equal(nav.panel, "welcome");
  assert.equal(nav.collapsed, false);
});

test("closed selected provider falls back to recent account of the first open provider", () => {
  const peers = [...accounts, { ...accounts[1], id: "private-zalo-second" }];
  const nav = normalizeWorkspaceNavigation(
    {
      active: "private-web",
      providerTabs: { open: ["zalo"] },
      lastAccounts: { zalo: "private-zalo-second" },
      panel: "service",
    },
    peers,
    true,
  );
  assert.equal(nav.active, "private-zalo-second");
  assert.equal(nav.panel, "service");
});
