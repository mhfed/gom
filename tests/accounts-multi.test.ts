import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultAccounts,
  accountPartition,
  validateCatalog,
  createAccount,
  editAccount,
  archiveAccount,
  restoreAccount,
  moveAccount,
  AccountCatalogStore,
} from "../src/main/accounts.ts";
import { normalizePreferences } from "../src/main/preferences.ts";
import { ViewRegistry } from "../src/main/view-registry.ts";
import type { Account, ProviderDefinition } from "../src/shared.ts";
const uuid = "12345678-1234-4234-8234-123456789abc";
test("legacy migration keeps exact partition names; new same-platform accounts have immutable separate partitions", () => {
  const legacy = defaultAccounts();
  assert.deepEqual(legacy.map(accountPartition), [
    "persist:zalo",
    "persist:messenger",
    "persist:telegram",
  ]);
  const added = createAccount("zalo", "Công việc", "💼", uuid);
  assert.equal(added.id, "acc_" + uuid);
  assert.equal(accountPartition(added), "persist:tn-account-acc_" + uuid);
  const edited = editAccount([...legacy, added], added.id, "Tên mới", "M");
  assert.equal(accountPartition(edited[3]), accountPartition(added));
  assert.equal(edited[0].id, "zalo");
});
test("catalog rejects provider reassignment, duplicate IDs, path-like IDs and missing legacy references", () => {
  const accounts = defaultAccounts();
  for (const list of [
    [...accounts, accounts[0]],
    accounts.map((a) =>
      a.id === "zalo" ? { ...a, provider: "messenger" } : a,
    ),
    [
      ...accounts,
      {
        id: "../zalo",
        provider: "zalo",
        name: "x",
        avatar: "x",
        archived: false,
      },
    ],
    accounts.slice(1),
  ]) {
    assert.throws(() => validateCatalog({ version: 1, accounts: list }));
  }
  assert.throws(() => validateCatalog({ version: 99, accounts }));
});
test("archive is reversible and never changes session identity; last enabled account cannot be archived", () => {
  let accounts = [
    ...defaultAccounts(),
    createAccount("zalo", "Work", "W", uuid),
  ];
  accounts = archiveAccount(accounts, "zalo");
  assert.equal(accounts[0].archived, true);
  assert.equal(accountPartition(accounts[0]), "persist:zalo");
  accounts = restoreAccount(accounts, "zalo");
  assert.equal(accounts[0].archived, false);
  for (const id of ["zalo", "messenger", "telegram"])
    accounts = archiveAccount(accounts, id);
  assert.throws(() => archiveAccount(accounts, "acc_" + uuid));
});
test("reordering stays within provider and keeps all account IDs/other-platform order", () => {
  const accounts = [
    ...defaultAccounts(),
    createAccount("zalo", "Work", "W", uuid),
  ];
  const moved = moveAccount(accounts, "acc_" + uuid, -1);
  assert.deepEqual(
    moved.filter((a) => a.provider === "zalo").map((a) => a.id),
    ["acc_" + uuid, "zalo"],
  );
  assert.deepEqual(
    moved.filter((a) => a.provider !== "zalo").map((a) => a.id),
    ["messenger", "telegram"],
  );
});
test("per-account preferences preserve old choices and reject unknown account IDs", () => {
  const id = "acc_" + uuid;
  const prefs = normalizePreferences(
    {
      notifications: {
        zalo: "mute",
        telegram: "allow",
        [id]: "allow",
        evil: "allow",
      },
    },
    ["zalo", "messenger", "telegram", id],
  );
  assert.deepEqual(prefs.notifications, {
    zalo: "mute",
    messenger: "ask",
    telegram: "allow",
    [id]: "allow",
  });
});
test("registry removal detaches only requested account and restored entry gets a new view", () => {
  let next = 0;
  const r = new ViewRegistry<{ n: number }, string>(() => ({ n: ++next }));
  const a = r.activate("zalo"),
    b = r.activate("acc_" + uuid);
  assert.equal(r.remove("acc_" + uuid), b);
  assert.equal(r.peek("zalo"), a);
  assert.notEqual(r.activate("acc_" + uuid), b);
});
test("catalog writes are durable and corrupt primary falls back read-only without overwriting metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "tin-nhan-catalog-"));
  try {
    const path = join(root, "accounts.json");
    const store = new AccountCatalogStore(path);
    const initial = await store.load();
    assert.equal(initial.writable, true);
    await store.commit([
      ...initial.accounts,
      createAccount("telegram", "Work", "W", uuid),
    ]);
    assert.equal(JSON.parse(await readFile(path, "utf8")).accounts.length, 4);
    await writeFile(path, "broken");
    const restored = new AccountCatalogStore(path);
    const safe = await restored.load();
    assert.equal(safe.writable, false);
    assert.equal(safe.accounts.length, 3);
    await assert.rejects(() => restored.commit(defaultAccounts()));
    assert.equal(await readFile(path, "utf8"), "broken");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("missing primary with corrupt backup stays read-only instead of creating a misleading default catalog", async () => {
  const root = await mkdtemp(join(tmpdir(), "tin-nhan-bad-backup-"));
  try {
    const path = join(root, "accounts.json");
    await writeFile(path + ".backup", "broken");
    const store = new AccountCatalogStore(path);
    const result = await store.load();
    assert.equal(result.writable, false);
    await assert.rejects(() => readFile(path, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const websiteId = "web_87654321-1234-4234-8234-123456789abc";
const website: ProviderDefinition = {
  id: websiteId,
  label: "Team website",
  entry: "https://work.example.test:8443/dashboard",
  hosts: ["work.example.test"],
  color: "#087f7a",
  custom: true,
};
const websiteAccount: Account = {
  id: "acc_" + uuid,
  provider: websiteId,
  name: "Cá nhân",
  avatar: "CN",
  archived: false,
};

test("v2 catalog restores registered websites without changing legacy or isolated account partitions", () => {
  const accounts = validateCatalog({
    version: 2,
    providers: [website],
    accounts: [...defaultAccounts(), websiteAccount],
  });
  assert.equal(accounts[3].provider, websiteId);
  assert.deepEqual(accounts.map(accountPartition), [
    "persist:zalo",
    "persist:messenger",
    "persist:telegram",
    "persist:tn-account-acc_" + uuid,
  ]);
  assert.throws(() => accountPartition({ ...websiteAccount, id: websiteId }));
  assert.throws(() => validateCatalog({ version: 2, providers: [], accounts }));
  assert.throws(() =>
    validateCatalog({ version: 2, providers: [website, website], accounts }),
  );
});

test("legacy catalog upgrades on a successful atomic website/account commit and preserves the registry on later account edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "gom-providers-"));
  try {
    const path = join(root, "accounts.json");
    await writeFile(
      path,
      JSON.stringify({ version: 1, accounts: defaultAccounts() }),
    );
    const store = new AccountCatalogStore(path);
    const before = await store.load();
    assert.equal(before.providers.length, 3);
    assert.deepEqual(before.accounts.map(accountPartition), [
      "persist:zalo",
      "persist:messenger",
      "persist:telegram",
    ]);
    const next = [...before.accounts, websiteAccount];
    await store.commit(next, [...before.providers, website]);
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.version, 2);
    assert.equal(saved.providers.length, 1);
    assert.equal(saved.providers[0].id, websiteId);
    assert.equal(saved.accounts[3].provider, websiteId);
    const reopened = new AccountCatalogStore(path);
    const after = await reopened.load();
    assert.equal(after.writable, true);
    assert.equal(
      after.providers[3].entry,
      "https://work.example.test:8443/dashboard",
    );
    await reopened.commit(
      editAccount(after.accounts, websiteAccount.id, "Work", "W"),
    );
    const retained = await new AccountCatalogStore(path).load();
    assert.equal(retained.providers[3].id, websiteId);
    assert.equal(retained.accounts[3].name, "Work");
    const good = await readFile(path, "utf8");
    await assert.rejects(() =>
      reopened.commit(retained.accounts, before.providers),
    );
    assert.equal(await readFile(path, "utf8"), good);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("v2 backup retains matching website definitions and sessions while blocking further writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "gom-provider-backup-"));
  try {
    const path = join(root, "accounts.json");
    const store = new AccountCatalogStore(path);
    const initial = await store.load();
    const accounts = [...initial.accounts, websiteAccount];
    await store.commit(accounts, [...initial.providers, website]);
    await store.commit(editAccount(accounts, websiteAccount.id, "Latest", "L"));
    await writeFile(path, "broken");
    const recovered = new AccountCatalogStore(path);
    const result = await recovered.load();
    assert.equal(result.writable, false);
    assert.equal(result.providers[3].id, websiteId);
    assert.equal(result.accounts[3].provider, websiteId);
    assert.equal(result.accounts[3].name, "Cá nhân");
    assert.equal(
      accountPartition(result.accounts[3]),
      "persist:tn-account-acc_" + uuid,
    );
    await assert.rejects(() => recovered.commit(result.accounts));
    assert.equal(await readFile(path, "utf8"), "broken");
    const reloaded = await store.load();
    assert.equal(reloaded.writable, false);
    await assert.rejects(() => store.commit(reloaded.accounts));
    assert.equal(await readFile(path, "utf8"), "broken");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("catalog rejects malformed custom entries and unregistered custom accounts", () => {
  const accounts = [...defaultAccounts(), websiteAccount];
  for (const providers of [
    undefined,
    [{ ...website, id: "web_bad" }],
    [{ ...website, id: "zalo" }],
    [{ ...website, entry: "javascript:alert(1)" }],
    [{ ...website, entry: "https://user:secret@example.test/" }],
    [{ ...website, label: " " }],
  ])
    assert.throws(() => validateCatalog({ version: 2, providers, accounts }));
  const created = createAccount(websiteId, "Work", "W", uuid);
  assert.equal(created.provider, websiteId);
  assert.throws(() =>
    validateCatalog({ version: 1, accounts: [...defaultAccounts(), created] }),
  );
});
