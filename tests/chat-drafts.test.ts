import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DraftStore, type DraftCodec } from "../src/main/chat/draft-store.ts";

const ref = { accountId: "account-one", conversationId: "thread-one" };
function codec(key = randomBytes(32)): DraftCodec {
  return {
    encrypt(text) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const bytes = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
    },
    decrypt(bytes) {
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
}
async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "tin-nhan-chat-drafts-"));
  t.after(async () => {
    await chmod(root, 0o700);
    await rm(root, { recursive: true, force: true });
  });
  const path = join(root, "drafts.enc"),
    encryption = codec();
  return { root, path, encryption, store: new DraftStore(path, encryption) };
}

test("drafts cannot write before load; a missing file initializes without writing or inventing a draft", async (t) => {
  const { store, path } = await setup(t);
  assert.throws(() => store.get(ref), { code: "not-loaded" });
  await assert.rejects(store.save(ref, "unsaved", 0), { code: "not-loaded" });
  assert.deepEqual(await store.load(), { writable: true, reason: null });
  assert.deepEqual(store.get(ref), { text: null, revision: 0 });
  await assert.rejects(readFile(path), { code: "ENOENT" });
});

test("encrypted disk round-trip preserves Vietnamese text and separates accounts and topics", async (t) => {
  const { store, path, encryption } = await setup(t);
  await store.load();
  const second = { ...ref, accountId: "account-two" };
  const topic = { ...ref, topicId: "topic-one" };
  assert.deepEqual(
    await store.save(ref, "  Bản nháp tiếng Việt\nchưa gửi.  ", 0),
    { text: "  Bản nháp tiếng Việt\nchưa gửi.  ", revision: 1 },
  );
  await store.save(second, "Tài khoản thứ hai", 0);
  await store.save(topic, "Chủ đề riêng", 0);
  const bytes = await readFile(path);
  assert.equal(bytes.includes(Buffer.from("Bản nháp")), false);
  assert.equal(bytes.includes(Buffer.from("account-one")), false);
  const metadata = await stat(path);
  assert.equal(metadata.isFile(), true);
  // Windows exposes file attributes here; Unix permission bits do not map to ACLs.
  if (process.platform !== "win32") assert.equal(metadata.mode & 0o777, 0o600);
  const loaded = new DraftStore(path, encryption);
  await loaded.load();
  assert.deepEqual(loaded.get(ref), {
    text: "  Bản nháp tiếng Việt\nchưa gửi.  ",
    revision: 1,
  });
  assert.deepEqual(loaded.get(second), {
    text: "Tài khoản thứ hai",
    revision: 1,
  });
  assert.deepEqual(loaded.get(topic), { text: "Chủ đề riêng", revision: 1 });
});

test("unchanged drafts avoid disk writes but stale revisions still conflict", async (t) => {
  const { store, path } = await setup(t);
  await store.load();
  await store.save(ref, "Giữ nguyên", 0);
  const before = await readFile(path),
    beforeStat = await stat(path);
  assert.deepEqual(await store.save(ref, "Giữ nguyên", 1), {
    text: "Giữ nguyên",
    revision: 1,
  });
  assert.deepEqual(await readFile(path), before);
  assert.equal((await stat(path)).ino, beforeStat.ino);
  await assert.rejects(store.save(ref, "Giữ nguyên", 0), {
    code: "revision-conflict",
  });
});

test("simultaneous stale editor saves serialize and only one revision wins", async (t) => {
  const { store, path, encryption } = await setup(t);
  await store.load();
  const results = await Promise.allSettled([
    store.save(ref, "Editor one", 0),
    store.save(ref, "Editor two", 0),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  if (results[1].status === "rejected")
    assert.equal(results[1].reason.code, "revision-conflict");
  const restarted = new DraftStore(path, encryption);
  await restarted.load();
  assert.deepEqual(restarted.get(ref), { text: "Editor one", revision: 1 });
});

test("deletion tombstones survive restart and reject stale resend clears and ABA recreations", async (t) => {
  const { store, path, encryption } = await setup(t);
  await store.load();
  await store.save(ref, "First attempt", 0);
  assert.deepEqual(await store.remove(ref, 1), { text: null, revision: 2 });
  const restarted = new DraftStore(path, encryption);
  await restarted.load();
  assert.deepEqual(restarted.get(ref), { text: null, revision: 2 });
  for (const revision of [0, 1])
    await assert.rejects(restarted.save(ref, "Late edit", revision), {
      code: "revision-conflict",
    });
  await restarted.save(ref, "New draft", 2);
  await assert.rejects(restarted.remove(ref, 1), { code: "revision-conflict" });
  assert.deepEqual(restarted.get(ref), { text: "New draft", revision: 3 });
  assert.deepEqual(await restarted.remove(ref, 3), { text: null, revision: 4 });
  const bytes = await readFile(path);
  assert.deepEqual(await restarted.remove(ref, 4), { text: null, revision: 4 });
  assert.deepEqual(await readFile(path), bytes);
});

test("encryption failure leaves memory and disk unchanged and the write queue can recover", async (t) => {
  const { path, encryption } = await setup(t);
  let unavailable = false;
  const store = new DraftStore(path, {
    ...encryption,
    encrypt(text) {
      if (unavailable) throw Error("keychain locked");
      return encryption.encrypt(text);
    },
  });
  await store.load();
  await store.save(ref, "Existing draft", 0);
  const before = await readFile(path);
  unavailable = true;
  await assert.rejects(store.save(ref, "Must not commit", 1), {
    code: "write-failed",
  });
  await assert.rejects(store.remove(ref, 1), { code: "write-failed" });
  assert.deepEqual(store.get(ref), { text: "Existing draft", revision: 1 });
  assert.deepEqual(await readFile(path), before);
  unavailable = false;
  assert.deepEqual(await store.save(ref, "Recovered", 1), {
    text: "Recovered",
    revision: 2,
  });
});

test("a real filesystem write failure preserves prior ciphertext and revision", async (t) => {
  const { store, path, root } = await setup(t);
  await store.load();
  await store.save(ref, "Safe prior draft", 0);
  const before = await readFile(path);
  const displaced = root + ".saved";
  await rename(root, displaced);
  try {
    // A file at the parent path blocks writes on Windows as well as Unix.
    await writeFile(root, "not a directory");
    await assert.rejects(store.save(ref, "Cannot write", 1), {
      code: "write-failed",
    });
    assert.deepEqual(store.get(ref), { text: "Safe prior draft", revision: 1 });
    assert.deepEqual(await readFile(join(displaced, "drafts.enc")), before);
  } finally {
    await rm(root, { force: true });
    await rename(displaced, root);
  }
  assert.deepEqual(await readFile(path), before);
  assert.deepEqual((await readdir(root)).sort(), ["drafts.enc"]);
  await store.save(ref, "Retry succeeds", 1);
  assert.deepEqual(store.get(ref), { text: "Retry succeeds", revision: 2 });
});

test("decryption failure locks writes, exposes no empty replacement and preserves the original", async (t) => {
  const { store, path, encryption } = await setup(t);
  await store.load();
  await store.save(ref, "Recoverable secret", 0);
  const before = await readFile(path);
  const locked = new DraftStore(path, codec());
  assert.deepEqual(await locked.load(), {
    writable: false,
    reason: "decrypt-failed",
  });
  assert.throws(() => locked.get(ref), { code: "locked" });
  await assert.rejects(locked.save(ref, "Overwrite", 0), { code: "locked" });
  await assert.rejects(locked.remove(ref, 0), { code: "locked" });
  assert.deepEqual(await locked.load(), {
    writable: false,
    reason: "decrypt-failed",
  });
  assert.deepEqual(await readFile(path), before);
  const recovered = new DraftStore(path, encryption);
  await recovered.load();
  assert.deepEqual(recovered.get(ref), {
    text: "Recoverable secret",
    revision: 1,
  });
});

test("malformed decrypted payloads are locked without silently salvaging or overwriting", async (t) => {
  const { path, encryption } = await setup(t);
  const entry = { ref, revision: 1, text: "valid" };
  const payloads = [
    "not json",
    JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, entries: [entry, entry] }),
    JSON.stringify({ version: 1, entries: [{ ...entry, revision: 0 }] }),
    JSON.stringify({ version: 1, entries: [{ ...entry, revision: 1.5 }] }),
    JSON.stringify({
      version: 1,
      entries: [{ ...entry, ref: { ...ref, topicId: "" } }],
    }),
    JSON.stringify({ version: 1, entries: [{ ...entry, text: {} }] }),
    JSON.stringify({ version: 1, entries: {} }),
  ];
  for (const payload of payloads) {
    const bytes = await encryption.encrypt(payload);
    await writeFile(path, bytes);
    const locked = new DraftStore(path, encryption);
    assert.deepEqual(await locked.load(), {
      writable: false,
      reason: "invalid-data",
    });
    await assert.rejects(locked.save(ref, "Overwrite", 0), { code: "locked" });
    assert.deepEqual(await readFile(path), bytes);
  }
});

test("a non-missing read failure is locked instead of being treated as an empty store", async (t) => {
  const { path, encryption } = await setup(t);
  await mkdir(path);
  const store = new DraftStore(path, encryption);
  assert.deepEqual(await store.load(), {
    writable: false,
    reason: "read-failed",
  });
  await assert.rejects(store.save(ref, "Must not replace directory", 0), {
    code: "locked",
  });
  assert.equal((await stat(path)).isDirectory(), true);
});

test("queued saves snapshot caller identity and getters cannot mutate stored revision", async (t) => {
  const { path, encryption } = await setup(t);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const store = new DraftStore(path, {
    ...encryption,
    async encrypt(text) {
      entered();
      await gate;
      return encryption.encrypt(text);
    },
  });
  await store.load();
  const mutable = { ...ref };
  const pending = store.save(mutable, "Queued content", 0);
  mutable.accountId = "wrong-account";
  await started;
  assert.deepEqual(store.get(ref), { text: null, revision: 0 });
  release();
  await pending;
  const value = store.get(ref);
  value.text = "Caller mutation";
  value.revision = 100;
  assert.deepEqual(store.get(ref), { text: "Queued content", revision: 1 });
  assert.deepEqual(store.get(mutable), { text: null, revision: 0 });
});

test("readers see only complete encrypted snapshots during replacement writes", async (t) => {
  const { store, path, encryption, root } = await setup(t);
  await store.load();
  await store.save(ref, "0".repeat(16000), 0);
  let finished = false;
  let resumeFrom = 9;
  const writes = (async () => {
    try {
      for (let revision = 1; revision <= 8; revision++) {
        try {
          await store.save(ref, String(revision).repeat(16000), revision);
        } catch (error) {
          // Windows can refuse replacing a file held by a concurrent reader.
          // The failure must roll back; finish the remaining saves once that
          // reader closes, without treating a rejected write as a commit.
          if (
            process.platform !== "win32" ||
            (error as { code?: string }).code !== "write-failed"
          )
            throw error;
          assert.deepEqual(store.get(ref), {
            text: String(revision - 1).repeat(16000),
            revision,
          });
          resumeFrom = revision;
          break;
        }
      }
    } finally {
      finished = true;
    }
  })();
  // Preserve the later rejection while avoiding a temporarily unhandled promise.
  void writes.catch(() => {});
  let reads = 0;
  do {
    const plain = await encryption.decrypt(await readFile(path));
    const payload = JSON.parse(plain);
    assert.equal(payload.entries.length, 1);
    const { text, revision } = payload.entries[0];
    assert.equal(text, String(revision - 1).repeat(16000));
    reads++;
  } while (!finished);
  await writes;
  for (let revision = resumeFrom; revision <= 8; revision++)
    await store.save(ref, String(revision).repeat(16000), revision);
  assert.ok(reads > 0);
  assert.deepEqual((await readdir(root)).sort(), ["drafts.enc"]);
  assert.equal(store.get(ref).revision, 9);
});

test("invalid revisions/text and exhausted revision counters cannot commit", async (t) => {
  const { store, path, encryption } = await setup(t);
  await store.load();
  for (const revision of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(store.save(ref, "x", revision), {
      code: "invalid-revision",
    });
  await assert.rejects(store.save(ref, null as unknown as string, 0), {
    code: "invalid-text",
  });
  await assert.rejects(readFile(path), { code: "ENOENT" });
  const bytes = await encryption.encrypt(
    JSON.stringify({
      version: 1,
      entries: [{ ref, text: null, revision: Number.MAX_SAFE_INTEGER }],
    }),
  );
  await writeFile(path, bytes);
  const exhausted = new DraftStore(path, encryption);
  await exhausted.load();
  await assert.rejects(
    exhausted.save(ref, "No wrapping", Number.MAX_SAFE_INTEGER),
    { code: "revision-exhausted" },
  );
  assert.deepEqual(await readFile(path), bytes);
});

test("codec is mandatory and a plaintext result is never used as a fallback", async (t) => {
  const { path, encryption } = await setup(t);
  assert.throws(
    () => new DraftStore(path, undefined as unknown as DraftCodec),
    { code: "invalid-codec" },
  );
  const broken = new DraftStore(path, {
    ...encryption,
    encrypt: () => "plaintext" as unknown as Buffer,
  });
  await broken.load();
  await assert.rejects(broken.save(ref, "Do not persist this", 0), {
    code: "write-failed",
  });
  await assert.rejects(readFile(path), { code: "ENOENT" });
});
