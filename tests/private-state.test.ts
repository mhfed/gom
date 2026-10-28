import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateState } from "../src/main/private-state.ts";
import {
  defaultAccounts,
  validateCatalog,
  AccountCatalogStore,
} from "../src/main/accounts.ts";
import { defaultProviders } from "../src/main/providers.ts";
import type { AppState, Account } from "../src/shared.ts";

function fixture(): AppState {
  const accounts: Account[] = [
    {
      id: "public",
      provider: "zalo",
      name: "Public",
      avatar: "P",
      archived: false,
    },
    {
      id: "hidden",
      provider: "web_secret",
      name: "Secret Person",
      avatar: "S",
      archived: false,
      private: true,
    },
  ];
  return {
    accounts,
    providers: [
      ...defaultProviders(),
      {
        id: "web_secret",
        label: "Secret site",
        entry: "https://secret.test/",
        hosts: ["secret.test"],
        color: "#000",
        custom: true,
      },
    ],
    providerTabs: { open: ["zalo", "web_secret"], pinned: ["web_secret"] },
    presentation: {
      sidebarWidth: 224,
      theme: "platform",
      pinned: ["hidden", "public"],
    },
    preferences: {
      paused: false,
      shortcut: false,
      updateChecks: true,
      notifications: { public: "allow", hidden: "allow" },
    },
    connections: {
      public: { phase: "connected", reason: null, retryAt: null },
      hidden: { phase: "error", reason: "blocked", retryAt: 42 },
    },
    themes: { public: null, hidden: null },
    unread: {
      public: {
        count: 0,
        kind: "messages",
        approximate: false,
        source: "platform",
      },
      hidden: {
        count: 9,
        kind: "messages",
        approximate: false,
        source: "platform",
      },
    },
    statuses: { public: "ready", hidden: "authenticated" },
    active: "hidden",
    panel: "service",
    commandOpen: false,
    accountBusy: false,
    catalogWarning: "",
    canGoBack: true,
    openAtLogin: false,
    startupAvailable: true,
    notificationStatus: "Secret Person sent notification",
    collapsed: false,
    profiles: [],
    importing: false,
    notice: "Secret Person",
    version: "1",
    updates: {
      phase: "idle",
      currentVersion: "1",
      message: "",
      latestVersion: null,
      releaseUrl: null,
      releaseNotes: "",
      checkedAt: null,
      downloadProgress: null,
      automaticInstallAvailable: false,
    },
  } as AppState;
}

test("locked snapshot removes private account IDs and provider details from every published surface", () => {
  const state = fixture();
  const locked = privateState(state, false);
  const json = JSON.stringify(locked);
  for (const secret of [
    "hidden",
    "Secret Person",
    "web_secret",
    "Secret site",
    "secret.test",
  ])
    assert.equal(json.includes(secret), false, secret);
  assert.equal(locked.active, "public");
  assert.equal(locked.canGoBack, false);
  assert.equal(locked.panel, "welcome");
  assert.equal(state.accounts.length, 2);
  assert.equal(state.active, "hidden");
  assert.equal(privateState(state, true).accounts.length, 2);
});

test("a catalog containing only private accounts yields an empty welcome, never a hidden active fallback", () => {
  const state = fixture();
  state.accounts = state.accounts.filter((a) => a.private);
  const projected = privateState(state, false);
  assert.equal(projected.active, "");
  assert.equal(projected.panel, "welcome");
  assert.deepEqual(projected.accounts, []);
  assert.deepEqual(projected.unread, {});
  assert.ok(projected.providers.some((p) => p.id === "zalo"));
});

test("locked private-only catalogs still allow settings and the provider library", () => {
  const state = fixture();
  state.accounts = state.accounts.filter((account) => account.private);
  for (const panel of ["settings", "providers", "welcome"] as const) {
    state.panel = panel;
    state.commandOpen = true;
    const projected = privateState(state, false);
    assert.equal(projected.panel, panel);
    assert.equal(projected.active, "");
    assert.equal(projected.canGoBack, false);
    assert.equal(projected.commandOpen, true);
    assert.deepEqual(projected.accounts, []);
  }
});

test("catalog persists private membership and rejects malformed values", async () => {
  const accounts = defaultAccounts();
  accounts[0].private = true;
  assert.equal(validateCatalog({ version: 1, accounts })[0].private, true);
  assert.throws(() =>
    validateCatalog({
      version: 1,
      accounts: [{ ...accounts[0], private: "yes" }, ...accounts.slice(1)],
    }),
  );
  const dir = await mkdtemp(join(tmpdir(), "gom-private-catalog-"));
  try {
    const path = join(dir, "accounts.json");
    const store = new AccountCatalogStore(path);
    await store.load();
    await store.commit(accounts);
    assert.equal(
      (await new AccountCatalogStore(path).load()).accounts[0].private,
      true,
    );
    await writeFile(path, "broken");
    const recovered = await new AccountCatalogStore(path).load(true);
    assert.equal(recovered.writable, false);
    assert.ok(
      recovered.accounts.every((a) => a.private),
      "uncertain backup membership must not expose sessions",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ordinary catalog corruption retains public read-only backup recovery without a password", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gom-public-catalog-recovery-"));
  try {
    const path = join(dir, "accounts.json");
    const store = new AccountCatalogStore(path);
    const initial = await store.load();
    await store.commit(initial.accounts);
    await writeFile(path, "broken");
    const recovered = await new AccountCatalogStore(path).load(false);
    assert.equal(recovered.writable, false);
    assert.ok(recovered.accounts.every((account) => !account.private));
    assert.ok(recovered.warning);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing catalog with existing private configuration never exposes default session partitions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gom-missing-private-catalog-"));
  try {
    const path = join(dir, "accounts.json");
    const recovered = await new AccountCatalogStore(path).load(true);
    assert.equal(recovered.writable, false);
    assert.ok(recovered.accounts.length > 0);
    assert.ok(recovered.accounts.every((account) => account.private));
    const clean = await new AccountCatalogStore(
      join(dir, "first-install.json"),
    ).load(false);
    assert.equal(clean.writable, true);
    assert.ok(clean.accounts.every((account) => !account.private));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
