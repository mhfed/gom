import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ReminderStore } from "../src/main/reminders.ts";

const now = 1_800_000_000_000;
const day = 86_400_000;
const key = randomBytes(32);
const codec = {
  encrypt(text: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const bytes = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
  },
  decrypt(encoded: string) {
    const bytes = Buffer.from(encoded, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  },
};
async function fixture(work: (path: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "gom-reminders-"));
  try {
    await work(join(directory, "reminders.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const input = (note = "Chiều gửi báo giá") => ({
  accountId: "zalo",
  note,
  dueAt: now + day,
});
const decode = (bytes: string) =>
  JSON.parse(codec.decrypt(JSON.parse(bytes).data));
const encode = (items: unknown[]) =>
  JSON.stringify({
    version: 1,
    data: codec.encrypt(JSON.stringify({ version: 1, items })),
  });

test("reminders require loading and a missing file starts empty without a plaintext write", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await assert.rejects(store.add(input(), now));
    await store.load();
    assert.deepEqual(store.snapshot(), {
      items: [],
      unavailable: false,
      error: "",
    });
    await assert.rejects(readFile(path), { code: "ENOENT" });
    await store.flush();
  }));

test("encrypted reminders survive restart with their account, note and selected date", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input("  Chiều gửi báo giá  "), now);
    assert.equal(item.note, "Chiều gửi báo giá");
    assert.equal(item.accountId, "zalo");
    assert.equal(item.dueAt, now + day);
    assert.equal(item.createdAt, now);
    assert.equal(item.completedAt, null);
    assert.equal(item.notifiedAt, null);
    const bytes = await readFile(path, "utf8");
    assert.equal(bytes.includes("Chiều gửi báo giá"), false);
    assert.equal(bytes.includes('"accountId"'), false);
    const next = new ReminderStore(path, codec);
    await next.load();
    assert.deepEqual(next.snapshot().items, [item]);
    assert.equal(next.snapshot().unavailable, false);
  }));

test("only one concurrent due claim is persisted and restart does not redeliver it", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input(), now);
    assert.equal(await store.claim(item.id, now + day - 1), null);
    const claimed = await Promise.all([
      store.claim(item.id, now + day),
      store.claim(item.id, now + day),
    ]);
    assert.equal(claimed.filter(Boolean).length, 1);
    assert.equal(claimed.find(Boolean)?.notifiedAt, now + day);
    const next = new ReminderStore(path, codec);
    await next.load();
    assert.equal(await next.claim(item.id, now + day + 1), null);
    assert.equal(await next.claim("missing", now + day + 1), null);
  }));

test("snooze re-arms a reminder, complete stops delivery, and remove persists deletion", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input(), now);
    await store.claim(item.id, now + day);
    await store.snooze(item.id, now + 2 * day, now + day);
    assert.equal(store.snapshot().items[0].notifiedAt, null);
    assert.equal(store.snapshot().items[0].dueAt, now + 2 * day);
    await store.complete(item.id, now + day + 1);
    assert.equal(store.snapshot().items[0].completedAt, now + day + 1);
    assert.equal(await store.claim(item.id, now + 3 * day), null);
    await store.complete(item.id, now + day + 2);
    assert.equal(store.snapshot().items[0].completedAt, now + day + 1);
    await store.snooze(item.id, now + 4 * day, now + 3 * day);
    assert.equal(store.snapshot().items[0].completedAt, null);
    assert.ok(await store.claim(item.id, now + 4 * day));
    await store.remove(item.id);
    await store.remove(item.id);
    const next = new ReminderStore(path, codec);
    await next.load();
    assert.deepEqual(next.snapshot().items, []);
  }));

test("snapshots, add results and queued input cannot mutate stored reminders", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const first = input();
    const pending = store.add(first, now);
    first.note = "Changed after enqueue";
    first.accountId = "telegram";
    const added = await pending;
    const snapshot = store.snapshot();
    added.note = "Changed result";
    snapshot.items[0].note = "Changed snapshot";
    snapshot.items.length = 0;
    assert.equal(store.snapshot().items[0].note, "Chiều gửi báo giá");
    assert.equal(store.snapshot().items[0].accountId, "zalo");
    await Promise.all([
      store.add(input("Second"), now),
      store.add({ ...input("Third"), accountId: "telegram" }, now),
    ]);
    assert.equal(store.snapshot().items.length, 3);
    assert.equal(decode(await readFile(path, "utf8")).items.length, 3);
  }));

test("invalid note, account and scheduling inputs are rejected without locking or overwriting", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    await store.add(input(), now);
    const before = await readFile(path, "utf8");
    for (const bad of [
      { ...input(), note: "  " },
      { ...input(), note: "x".repeat(501) },
      { ...input(), note: 3 },
      { ...input(), accountId: "" },
      { ...input(), accountId: " x " },
      { ...input(), accountId: "x\u0000" },
      { ...input(), accountId: "x".repeat(101) },
      { ...input(), dueAt: now },
      { ...input(), dueAt: now - 1 },
      { ...input(), dueAt: NaN },
      { ...input(), dueAt: now + 366 * day + 1 },
      { ...input(), dueAt: now + 1.1 },
    ])
      await assert.rejects(store.add(bad as ReturnType<typeof input>, now));
    const clean = await store.add(
      input("A\u0000B\u202eC\u200fD\u061cE\u0085F"),
      now,
    );
    assert.equal(clean.note, "A B C D E F");
    await assert.rejects(store.snooze(clean.id, now, now));
    assert.equal(store.snapshot().unavailable, false);
    assert.equal(store.snapshot().items[0].note, "Chiều gửi báo giá");
    assert.notEqual(await readFile(path, "utf8"), before);
  }));

test("corrupt, malformed and duplicate persisted entries lock writes without replacing original bytes", async () =>
  fixture(async (path) => {
    const valid = {
      id: "rem_12345678-1234-4234-8234-123456789abc",
      ...input(),
      createdAt: now,
      completedAt: null,
      notifiedAt: null,
    };
    const cases = [
      "broken",
      JSON.stringify({ version: 2, data: "x" }),
      JSON.stringify({ version: 1, data: "bad-ciphertext" }),
      JSON.stringify({
        version: 1,
        data: codec.encrypt(JSON.stringify({ version: 2, items: [] })),
      }),
      encode([valid, valid]),
      encode([{ ...valid, dueAt: "tomorrow" }]),
      encode([{ ...valid, dueAt: Number.MAX_SAFE_INTEGER }]),
      encode([{ ...valid, completedAt: false }]),
      encode([{ ...valid, note: "\u0000" }]),
      encode([{ ...valid, accountId: "zalo\n" }]),
    ];
    for (const bytes of cases) {
      await writeFile(path, bytes);
      const store = new ReminderStore(path, codec);
      await store.load();
      assert.equal(store.snapshot().unavailable, true, bytes.slice(0, 30));
      assert.deepEqual(store.snapshot().items, []);
      await assert.rejects(store.add(input(), now));
      assert.equal(await readFile(path, "utf8"), bytes);
      await store.load();
      assert.equal(store.snapshot().unavailable, true);
    }
  }));

test("oversized and unreadable stores fail closed before decrypting", async () =>
  fixture(async (path) => {
    await writeFile(path, Buffer.alloc(1_048_577, 65));
    let reads = 0;
    const guarded = {
      ...codec,
      decrypt(data: string) {
        reads++;
        return codec.decrypt(data);
      },
    };
    let store = new ReminderStore(path, guarded);
    await store.load();
    assert.equal(store.snapshot().unavailable, true);
    assert.equal(reads, 0);
    await rm(path);
    await mkdir(path);
    store = new ReminderStore(path, guarded);
    await store.load();
    assert.equal(store.snapshot().unavailable, true);
    assert.equal(reads, 0);
  }));

test("encryption failure preserves last committed reminders and locks further writes", async () =>
  fixture(async (path) => {
    let failing = false;
    const guarded = {
      ...codec,
      encrypt(text: string) {
        if (failing) throw Error("keychain locked");
        return codec.encrypt(text);
      },
    };
    const store = new ReminderStore(path, guarded);
    await store.load();
    const first = await store.add(input(), now);
    const bytes = await readFile(path, "utf8");
    failing = true;
    await assert.rejects(store.add(input("Not committed"), now));
    assert.equal(store.snapshot().unavailable, true);
    assert.deepEqual(store.snapshot().items, [first]);
    assert.equal(await readFile(path, "utf8"), bytes);
    failing = false;
    await assert.rejects(store.remove(first.id));
    assert.equal(await readFile(path, "utf8"), bytes);
  }));

test("an actual atomic-write failure leaves the saved file and delivery state unchanged", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const first = await store.add(input(), now);
    const bytes = await readFile(path, "utf8");
    await mkdir(path + ".tmp");
    await assert.rejects(store.claim(first.id, now + day));
    assert.equal(store.snapshot().unavailable, true);
    assert.equal(store.snapshot().items[0].notifiedAt, null);
    assert.equal(await readFile(path, "utf8"), bytes);
    const next = new ReminderStore(path, codec);
    await next.load();
    assert.equal(next.snapshot().items[0].notifiedAt, null);
  }));

test("the store enforces its limit without changing existing entries", async () =>
  fixture(async (path) => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `rem_12345678-1234-4234-8234-${i.toString().padStart(12, "0")}`,
      ...input(String(i)),
      createdAt: now,
      completedAt: null,
      notifiedAt: null,
    }));
    await writeFile(path, encode(items));
    const store = new ReminderStore(path, codec);
    await store.load();
    assert.equal(store.snapshot().items.length, 500);
    const bytes = await readFile(path, "utf8");
    await assert.rejects(store.add(input(), now));
    assert.equal(store.snapshot().unavailable, false);
    assert.equal(await readFile(path, "utf8"), bytes);
  }));

test("a cancelled delivery claim is re-armed without an older release clearing a new claim", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input(), now);
    const first = await store.claim(item.id, now + day);
    assert.ok(first);
    await store.releaseClaim(item.id, first.notifiedAt!);
    assert.equal(store.snapshot().items[0].notifiedAt, null);
    const second = await store.claim(item.id, now + day);
    assert.ok(second);
    assert.notEqual(
      second.notifiedAt,
      first.notifiedAt,
      "same-millisecond reclaim must have a fresh comparison token",
    );
    await store.releaseClaim(item.id, first.notifiedAt!);
    assert.equal(store.snapshot().items[0].notifiedAt, second.notifiedAt);
    await store.complete(item.id, now + day + 1);
    await store.releaseClaim(item.id, second.notifiedAt!);
    assert.equal(store.snapshot().items[0].notifiedAt, second.notifiedAt);
    await store.snooze(item.id, now + 2 * day, now + day + 2);
    await store.releaseClaim(item.id, second.notifiedAt!);
    assert.equal(store.snapshot().items[0].dueAt, now + 2 * day);
    assert.equal(store.snapshot().items[0].notifiedAt, null);
    await store.remove(item.id);
    await store.releaseClaim(item.id, second.notifiedAt!);
    assert.deepEqual(store.snapshot().items, []);
  }));

test("a codec missing-key error is not mistaken for a missing reminders file", async () =>
  fixture(async (path) => {
    const original = encode([]);
    await writeFile(path, original);
    const store = new ReminderStore(path, {
      ...codec,
      decrypt() {
        throw Object.assign(Error("missing key"), { code: "ENOENT" });
      },
    });
    await store.load();
    assert.equal(store.snapshot().unavailable, true);
    await assert.rejects(store.add(input(), now));
    assert.equal(await readFile(path, "utf8"), original);
  }));

test("a valid addition exceeding encrypted file capacity is rejected without locking the existing store", async () =>
  fixture(async (path) => {
    const items = [];
    for (let i = 0; i < 500; i++) {
      const item = {
        id: `rem_12345678-1234-4234-8234-${i.toString().padStart(12, "0")}`,
        ...input("🙂".repeat(500)),
        createdAt: now,
        completedAt: null,
        notifiedAt: null,
      };
      if (Buffer.byteLength(encode([...items, item])) > 1_048_576) break;
      items.push(item);
    }
    assert.ok(items.length > 0 && items.length < 500);
    const bytes = encode(items);
    await writeFile(path, bytes);
    const store = new ReminderStore(path, codec);
    await store.load();
    await assert.rejects(store.add(input("🙂".repeat(500)), now));
    assert.equal(store.snapshot().unavailable, false);
    assert.equal(store.snapshot().items.length, items.length);
    assert.equal(await readFile(path, "utf8"), bytes);
  }));

test("notes preserve LF and tabs, normalize CRLF and CR, and count Unicode codepoints", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(
      input("  First\r\nSecond\rThird\tcolumn\nLast  "),
      now,
    );
    assert.equal(item.note, "First\nSecond\nThird\tcolumn\nLast");
    await store.add(input("🙂".repeat(500)), now);
    await assert.rejects(store.add(input("🙂".repeat(501)), now));
    const next = new ReminderStore(path, codec);
    await next.load();
    assert.deepEqual(next.snapshot().items, store.snapshot().items);
  }));

test("asynchronous encryption and decryption preserve the encrypted store across restart", async () =>
  fixture(async (path) => {
    const asyncCodec = {
      encrypt: async (text: string) => codec.encrypt(text),
      decrypt: async (text: string) => codec.decrypt(text),
    };
    const store = new ReminderStore(path, asyncCodec);
    await store.load();
    const item = await store.add(input(), now);
    const next = new ReminderStore(path, asyncCodec);
    await next.load();
    assert.deepEqual(next.snapshot().items, [item]);
    assert.equal(next.snapshot().unavailable, false);
  }));

test("revoked guards cancel queued operations and pending encrypted publication without poisoning the store", async () =>
  fixture(async (path) => {
    let entered!: () => void, release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resumed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let wait = false;
    const store = new ReminderStore(path, {
      ...codec,
      async encrypt(text: string) {
        if (wait) {
          entered();
          await resumed;
        }
        return codec.encrypt(text);
      },
    });
    await store.load();
    const item = await store.add(input(), now);
    const bytes = await readFile(path, "utf8");
    let epoch = 0;
    const valid = () => epoch === 0;
    wait = true;
    const claim = store.claim(item.id, now + day, valid);
    const rejectedClaim = assert.rejects(claim, /reminders-cancelled/);
    await blocked;
    const queued = store.complete(item.id, now + day, valid);
    const rejectedQueued = assert.rejects(queued, /reminders-cancelled/);
    epoch = 2; // away and back still revokes the original capability
    release();
    await Promise.all([rejectedClaim, rejectedQueued]);
    assert.equal(await readFile(path, "utf8"), bytes);
    assert.deepEqual(store.snapshot().items, [item]);
    assert.equal(store.snapshot().unavailable, false);
    wait = false;
    await store.complete(item.id, now + day);
    assert.equal(store.snapshot().items[0].completedAt, now + day);
  }));

test("revocation after the actual temporary write cancels atomic publication and removes the temporary ciphertext", async (t) =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input(), now);
    const bytes = await readFile(path, "utf8");
    let valid = true,
      reachedWrite = false;
    const original = fs.writeFile;
    const hook = t.mock.method(
      fs,
      "writeFile",
      async (...args: Parameters<typeof writeFile>) => {
        await original(...args);
        if (args[0] === path + ".tmp") {
          reachedWrite = true;
          valid = false;
        }
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        store.claim(item.id, now + day, () => valid),
        /reminders-cancelled/,
      );
      assert.equal(reachedWrite, true);
      assert.equal(await readFile(path, "utf8"), bytes);
      await assert.rejects(readFile(path + ".tmp"), { code: "ENOENT" });
      assert.deepEqual(store.snapshot().items, [item]);
      assert.equal(store.snapshot().unavailable, false);
    } finally {
      hook.mock.restore();
      syncBuiltinESMExports();
    }
    assert.ok(await store.claim(item.id, now + day));
  }));

test("every guarded mutation rejects a revoked capability while retaining the committed store", async () =>
  fixture(async (path) => {
    const store = new ReminderStore(path, codec);
    await store.load();
    const item = await store.add(input(), now);
    const claimed = await store.claim(item.id, now + day);
    assert.ok(claimed);
    const bytes = await readFile(path, "utf8");
    const revoked = () => false;
    for (const mutate of [
      () => store.add(input(), now, revoked),
      () => store.complete(item.id, now + day, revoked),
      () => store.snooze(item.id, now + 2 * day, now + day, revoked),
      () => store.remove(item.id, revoked),
      () => store.claim(item.id, now + day, revoked),
      () => store.releaseClaim(item.id, claimed.notifiedAt!, revoked),
    ])
      await assert.rejects(mutate(), /reminders-cancelled/);
    assert.equal(await readFile(path, "utf8"), bytes);
    assert.deepEqual(store.snapshot().items, [claimed]);
    assert.equal(store.snapshot().unavailable, false);
  }));

test("an addition near the encrypted ceiling reserves room for future timestamps", async () =>
  fixture(async (path) => {
    const items = Array.from({ length: 363 }, (_, i) => ({
      id: `rem_12345678-1234-4234-8234-${i.toString().padStart(12, "0")}`,
      ...input("🙂".repeat(500)),
      createdAt: now,
      completedAt: null,
      notifiedAt: null,
    }));
    const bytes = encode(items);
    await writeFile(path, bytes);
    const store = new ReminderStore(path, {
      encrypt: async (text) => codec.encrypt(text),
      decrypt: async (text) => codec.decrypt(text),
    });
    await store.load();
    // This formerly accepted envelope is exactly 1,048,575 bytes; even one claim overflows it.
    await assert.rejects(
      store.add(input("🙂".repeat(166) + "x"), now),
      /reminders-limit/,
    );
    assert.equal(store.snapshot().unavailable, false);
    assert.deepEqual(store.snapshot().items, items);
    assert.equal(await readFile(path, "utf8"), bytes);
  }));

test("accepted near-capacity async AEAD reminders can claim, complete and snooze after restart", async () =>
  fixture(async (path) => {
    const maximumTime = 8_640_000_000_000_000;
    const items = Array.from({ length: 357 }, (_, i) => ({
      id: `rem_12345678-1234-4234-8234-${i.toString().padStart(12, "0")}`,
      ...input("🙂".repeat(500)),
      createdAt: now,
      completedAt: null,
      notifiedAt: null,
    }));
    await writeFile(path, encode(items));
    const asyncCodec = {
      encrypt: async (text: string) => codec.encrypt(text),
      decrypt: async (text: string) => codec.decrypt(text),
    };
    let store = new ReminderStore(path, asyncCodec);
    await store.load();
    const added = await store.add(input("🙂".repeat(500)), now);
    const acceptedBytes = await readFile(path, "utf8");
    await assert.rejects(
      store.add(input("🙂".repeat(500)), now),
      /reminders-limit/,
    );
    assert.equal(store.snapshot().unavailable, false);
    assert.equal(await readFile(path, "utf8"), acceptedBytes);
    store = new ReminderStore(path, asyncCodec);
    await store.load();
    for (const item of store.snapshot().items) {
      assert.ok(await store.claim(item.id, maximumTime - day));
      await store.complete(item.id, maximumTime);
    }
    await store.snooze(added.id, maximumTime - 1000, maximumTime - day);
    assert.ok(await store.claim(added.id, maximumTime - 1000));
    await store.complete(added.id, maximumTime);
    const finalBytes = await readFile(path, "utf8");
    assert.ok(Buffer.byteLength(finalBytes) <= 1_048_576);
    const restarted = new ReminderStore(path, asyncCodec);
    await restarted.load();
    assert.equal(restarted.snapshot().unavailable, false);
    assert.equal(restarted.snapshot().items.length, 358);
    assert.ok(
      restarted
        .snapshot()
        .items.every(
          (item) =>
            item.completedAt === maximumTime && item.notifiedAt !== null,
        ),
    );
    assert.equal(
      restarted.snapshot().items.find((item) => item.id === added.id)?.dueAt,
      maximumTime - 1000,
    );
  }));

test("revocation during an async capacity probe preserves the committed bytes and store health", async () =>
  fixture(async (path) => {
    const bytes = encode([]);
    await writeFile(path, bytes);
    let valid = true,
      revoke = true;
    const store = new ReminderStore(path, {
      ...codec,
      async encrypt(text) {
        await Promise.resolve();
        if (revoke && text.includes('"completedAt":8640000000000000'))
          valid = false;
        return codec.encrypt(text);
      },
    });
    await store.load();
    await assert.rejects(
      store.add(input(), now, () => valid),
      /reminders-cancelled/,
    );
    assert.equal(store.snapshot().unavailable, false);
    assert.deepEqual(store.snapshot().items, []);
    assert.equal(await readFile(path, "utf8"), bytes);
    await assert.rejects(readFile(path + ".tmp"), { code: "ENOENT" });
    revoke = false;
    valid = true;
    await store.add(input(), now, () => valid);
    assert.equal(store.snapshot().items.length, 1);
  }));
