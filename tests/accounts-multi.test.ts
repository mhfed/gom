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
