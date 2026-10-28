import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateSpaceStore } from "../src/main/private-space.ts";

async function fixture(run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "gom-private-"));
  try {
    await run(join(dir, "private-space.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("password verifier survives restart without storing the password and changes only after authentication", () =>
  fixture(async (path) => {
    const store = new PrivateSpaceStore(path);
    await store.load(false);
    assert.equal((await store.setup("mật khẩu riêng 123")).ok, true);
    assert.equal(
      (await readFile(path, "utf8")).includes("mật khẩu riêng 123"),
      false,
    );
    const restored = new PrivateSpaceStore(path);
    await restored.load(true);
    assert.equal((await restored.verify("mật khẩu riêng 123")).ok, true);
    assert.equal(
      (await restored.changePassword("mật khẩu riêng 123", "mật khẩu mới 456"))
        .ok,
      true,
    );
    const changed = new PrivateSpaceStore(path);
    await changed.load(true);
    assert.equal((await changed.verify("mật khẩu mới 456")).ok, true);
    assert.equal((await changed.verify("mật khẩu riêng 123")).ok, false);
  }));

test("concurrent setup cannot replace the winning password", () =>
  fixture(async (path) => {
    const store = new PrivateSpaceStore(path);
    await store.load(false);
    const results = await Promise.all([
      store.setup("first password"),
      store.setup("second password"),
    ]);
    assert.deepEqual(
      results.map((r) => r.ok),
      [true, false],
    );
    assert.equal((await store.verify("first password")).ok, true);
  }));

test("wrong password imposes a cooldown that survives restart and cannot be bypassed by concurrent attempts", () =>
  fixture(async (path) => {
    const store = new PrivateSpaceStore(path);
    await store.load(false);
    await store.setup("correct password");
    const results = await Promise.all([
      store.verify("wrong password"),
      store.verify("correct password"),
    ]);
    assert.deepEqual(
      results.map((r) => r.ok),
      [false, false],
    );
    assert.ok(store.status().retryAt > Date.now());
    const restored = new PrivateSpaceStore(path);
    await restored.load(true);
    assert.equal((await restored.verify("correct password")).ok, false);
  }));

test("missing or corrupt verifier with private accounts fails closed and cannot be replaced", () =>
  fixture(async (path) => {
    for (const content of [
      undefined,
      "broken",
      JSON.stringify({ version: 1, salt: "bad", hash: "bad" }),
    ]) {
      if (content !== undefined) await writeFile(path, content);
      const store = new PrivateSpaceStore(path);
      await store.load(true);
      assert.equal(store.status().unavailable, true);
      assert.equal((await store.setup("replacement password")).ok, false);
      assert.equal((await store.verify("replacement password")).ok, false);
    }
  }));

test("invalid or oversized passwords do not create a verifier; failed writes do not unlock setup", () =>
  fixture(async (path) => {
    const store = new PrivateSpaceStore(path);
    await store.load(false);
    for (const password of [
      "",
      "short",
      "x".repeat(257),
      null,
      { password: "valid password" },
    ])
      assert.equal((await store.setup(password)).ok, false);
    assert.equal(store.status().configured, false);
    await mkdir(path);
    assert.equal((await store.setup("valid password")).ok, false);
    assert.equal(store.status().configured, false);
  }));
