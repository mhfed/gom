import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rm,
  mkdir,
  open,
  lstat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { readdirSync, readFileSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { createCipheriv, randomBytes } from "node:crypto";
import { ShelfStore, type ShelfKeyCodec } from "../src/main/shelf-store.ts";
import { SHELF_LIMITS } from "../src/shelf-types.ts";

const codec: ShelfKeyCodec = {
  available: async () => true,
  encrypt: async (text) => Buffer.from(text).toString("base64"),
  decrypt: async (text) => Buffer.from(text, "base64").toString(),
};
async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "gom-shelf-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ShelfStore(root, codec);
  await store.load();
  return { root, store };
}
async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    result.push(...(entry.isDirectory() ? await files(path) : [path]));
  }
  return result;
}

test("restarts with separate encrypted namespaces and preserves LF, tabs, binary bytes", async (t) => {
  const { root, store } = await fixture(t);
  const text = "secret first\nsecond\tthird";
  assert.equal((await store.addText("normal", text)).ok, true);
  assert.equal((await store.addText("private", "private payload")).ok, true);
  const data = Buffer.from("original binary bytes");
  assert.equal(
    (
      await store.addBinary("normal", {
        kind: "file",
        name: "../../secret-document.txt",
        mime: "text/plain",
        data,
      })
    ).ok,
    true,
  );
  data.fill(0);
  await store.flush();
  for (const path of await files(root)) {
    const bytes = await readFile(path);
    for (const secret of [
      text,
      "private payload",
      "secret-document.txt",
      "original binary bytes",
    ])
      assert.equal(bytes.includes(Buffer.from(secret)), false);
  }
  const next = new ShelfStore(root, codec);
  await next.load();
  const normal = next.list("normal");
  assert.equal(normal.unavailable, false);
  assert.equal(normal.items.length, 2);
  assert.equal(normal.items.find((x) => x.kind === "text")?.text, text);
  const file = normal.items.find((x) => x.kind === "file")!;
  assert.equal(file.name, "secret-document.txt");
  assert.deepEqual(
    await next.readBinary("normal", file.id),
    Buffer.from("original binary bytes"),
  );
  assert.equal(await next.readBinary("private", file.id), null);
  assert.equal(next.list("private").items[0].text, "private payload");
  normal.items[0].name = "mutated";
  normal.items.length = 0;
  assert.equal(next.list("normal").items.length, 2);
});

test("serializes concurrent mutations, orders pins, and deletes only unpinned items in its namespace", async (t) => {
  const { root, store } = await fixture(t);
  const added = await Promise.all(
    Array.from({ length: 12 }, (_, i) => store.addText("normal", `entry ${i}`)),
  );
  assert.equal(
    added.every((r) => r.ok),
    true,
  );
  const id = store.list("normal").items.at(-1)!.id;
  assert.equal((await store.pin("normal", id, true)).ok, true);
  assert.equal(store.list("normal").items[0].id, id);
  await store.addText("private", "keep private");
  assert.equal((await store.clearUnpinned("normal")).ok, true);
  assert.deepEqual(
    store.list("normal").items.map((x) => x.id),
    [id],
  );
  assert.equal((await store.remove("private", id)).ok, false);
  assert.equal((await store.remove("normal", id)).ok, true);
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").items.length, 0);
  assert.equal(next.list("private").items.length, 1);
});

test("rejects invalid text, unsafe controls and oversized items without evicting old entries", async (t) => {
  const { store } = await fixture(t);
  for (const text of [
    "",
    "   ",
    "bad\u0000text",
    "x".repeat(SHELF_LIMITS.textBytes + 1),
  ])
    assert.equal((await store.addText("normal", text)).ok, false);
  assert.equal(
    (await store.addText("normal", "é".repeat(SHELF_LIMITS.textBytes / 2))).ok,
    true,
  );
  assert.equal(
    (
      await store.addBinary("normal", {
        kind: "file",
        name: "bad\nname",
        mime: "text/plain",
        data: Buffer.alloc(0),
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await store.addBinary("normal", {
        kind: "file",
        name: "huge",
        mime: "application/octet-stream",
        data: Buffer.alloc(SHELF_LIMITS.itemBytes + 1),
      })
    ).ok,
    false,
  );
  for (let i = 1; i < 100; i++)
    assert.equal((await store.addText("normal", `item ${i}`)).ok, true);
  assert.equal((await store.addText("normal", "overflow")).ok, false);
  assert.equal(store.list("normal").items.length, 100);
  assert.equal((await store.addText("private", "other namespace")).ok, true);
});

test("enforces total byte quota without evicting any existing file", async (t) => {
  const { store } = await fixture(t);
  const data = Buffer.alloc(SHELF_LIMITS.itemBytes, 37);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await store.addBinary("normal", {
          kind: "file",
          name: `${i}.bin`,
          mime: "application/octet-stream",
          data,
        })
      ).ok,
      true,
    );
  assert.equal(store.list("normal").totalBytes, 262144000);
  assert.equal((await store.addText("normal", "x")).ok, false);
  assert.equal(
    (
      await store.addBinary("normal", {
        kind: "file",
        name: "empty",
        mime: "application/octet-stream",
        data: Buffer.alloc(0),
      })
    ).ok,
    true,
  );
  assert.equal(store.list("normal").items.length, 6);
});

test("guards queued and late mutations before index commit", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "old");
  const before = store.list("normal");
  let calls = 0;
  const result = await store.addBinary(
    "normal",
    {
      kind: "file",
      name: "late.bin",
      mime: "application/octet-stream",
      data: Buffer.from("late"),
    },
    () => ++calls < 3,
  );
  assert.equal(result.ok, false);
  assert.deepEqual(store.list("normal"), before);
  assert.equal(
    (await store.pin("normal", before.items[0].id, true, () => false)).ok,
    false,
  );
  assert.equal(
    (await store.remove("normal", before.items[0].id, () => false)).ok,
    false,
  );
  assert.equal((await store.clearUnpinned("normal", () => false)).ok, false);
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.deepEqual(next.list("normal"), before);
});

test("fails closed on unavailable codec, missing key and tampered key without replacing persisted data", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "preserve me");
  const paths = await files(root);
  const key = paths.find((p) => p.endsWith("key.enc"))!;
  const original = await readFile(key);
  const unavailable = new ShelfStore(root, {
    ...codec,
    available: async () => false,
  });
  await unavailable.load();
  assert.equal(unavailable.list("normal").unavailable, true);
  assert.equal((await unavailable.addText("normal", "no")).ok, false);
  await rm(key);
  const missing = new ShelfStore(root, codec);
  await missing.load();
  assert.equal(missing.list("normal").unavailable, true);
  assert.equal((await files(root)).includes(key), false);
  await writeFile(key, "broken key");
  const broken = new ShelfStore(root, codec);
  await broken.load();
  assert.equal(broken.list("normal").unavailable, true);
  assert.equal((await readFile(key)).toString(), "broken key");
  await writeFile(key, original);
  const restored = new ShelfStore(root, codec);
  await restored.load();
  assert.equal(restored.list("normal").items[0].text, "preserve me");
});

test("preserves corrupted index and orphans, while healthy namespace cleanup removes owned orphans only", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "normal");
  await store.addText("private", "private");
  const index = join(root, "normal", "index.enc");
  const bytes = await readFile(index);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(index, bytes);
  const orphan = join(
    root,
    "normal",
    "blobs",
    "00000000-0000-4000-8000-000000000000.blob",
  );
  const healthyOrphan = join(
    root,
    "private",
    "blobs",
    "00000000-0000-4000-8000-000000000000.blob",
  );
  await writeFile(orphan, "preserve");
  await writeFile(healthyOrphan, "remove");
  await writeFile(join(root, "private", "blobs", "user.txt"), "keep");
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, true);
  assert.equal((await next.addText("normal", "no")).ok, false);
  assert.deepEqual(await readFile(index), bytes);
  assert.equal((await readFile(orphan)).toString(), "preserve");
  assert.equal(next.list("private").items[0].text, "private");
  assert.equal((await files(root)).includes(healthyOrphan), false);
  assert.equal(
    (await readFile(join(root, "private", "blobs", "user.txt"))).toString(),
    "keep",
  );
});

test("authenticates blob namespace and content and reports corrupt binary without altering it", async (t) => {
  const { root, store } = await fixture(t);
  await store.addBinary("normal", {
    kind: "image",
    name: "image.png",
    mime: "image/png",
    data: Buffer.from("image bytes"),
  });
  const id = store.list("normal").items[0].id;
  const path = join(root, "normal", "blobs", `${id}.blob`);
  const bytes = await readFile(path);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(path, bytes);
  assert.equal(await store.readBinary("normal", id), null);
  assert.equal(store.list("normal").unavailable, true);
  assert.deepEqual(await readFile(path), bytes);
});

test("failed atomic index replacement preserves old index and snapshot", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "old");
  const before = store.list("normal");
  const index = join(root, "normal", "index.enc");
  const saved = await readFile(index);
  await rm(index);
  await mkdir(index);
  assert.equal((await store.addText("normal", "new")).ok, false);
  assert.deepEqual(store.list("normal").items, before.items);
  await rm(index, { recursive: true });
  await writeFile(index, saved);
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.deepEqual(next.list("normal").items, before.items);
});

// An authenticated index still needs full schema and path validation.
test("rejects authenticated malformed metadata without deleting any files", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "safe");
  const key = Buffer.from(
    await codec.decrypt((await readFile(join(root, "key.enc"))).toString()),
    "base64",
  );
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("gom-shelf:v1:normal:index"));
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      revision: 1,
      items: [
        {
          id: "../../escape",
          kind: "file",
          createdAt: 1,
          pinned: false,
          name: "file",
          mime: "application/octet-stream",
          bytes: 1,
        },
      ],
    }),
  );
  const encoded = Buffer.concat([Buffer.from("GS01"), nonce]);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  await writeFile(
    join(root, "normal", "index.enc"),
    Buffer.concat([encoded, cipher.getAuthTag(), encrypted]),
  );
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, true);
  assert.equal((await next.remove("normal", "../../escape")).ok, false);
});

test("missing index in an existing empty namespace fails closed instead of recreating a blank shelf", async (t) => {
  const { root } = await fixture(t);
  const index = join(root, "normal", "index.enc");
  await rm(index);
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, true);
  assert.equal((await files(root)).includes(index), false);
  assert.equal(next.list("private").unavailable, false);
});

test("copies bytes at invocation even when the mutation must wait in the queue", async (t) => {
  const { store } = await fixture(t);
  const first = store.addText("normal", "queued");
  const bytes = Buffer.from("snapshot");
  const second = store.addBinary("normal", {
    kind: "file",
    name: "copy.bin",
    mime: "application/octet-stream",
    data: bytes,
  });
  bytes.fill(0);
  await Promise.all([first, second]);
  const item = store.list("normal").items.find((item) => item.kind === "file")!;
  assert.deepEqual(
    await store.readBinary("normal", item.id),
    Buffer.from("snapshot"),
  );
  const returned = await store.readBinary("normal", item.id);
  returned!.fill(0);
  assert.deepEqual(
    await store.readBinary("normal", item.id),
    Buffer.from("snapshot"),
  );
});

test("rejects cross-namespace ciphertext swaps before orphan cleanup", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "normal");
  await store.addText("private", "private");
  const normal = join(root, "normal", "index.enc");
  const other = join(root, "private", "index.enc");
  await writeFile(normal, await readFile(other));
  const orphan = join(
    root,
    "normal",
    "blobs",
    "00000000-0000-4000-8000-000000000000.blob",
  );
  await writeFile(orphan, "evidence");
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, true);
  assert.equal(next.list("private").items[0].text, "private");
  assert.equal((await readFile(orphan)).toString(), "evidence");
});

test("removing files commits index before cleaning owned originals and preserves unrelated files", async (t) => {
  const { root, store } = await fixture(t);
  await store.addBinary("normal", {
    kind: "file",
    name: "zero.bin",
    mime: "application/octet-stream",
    data: Buffer.alloc(0),
  });
  const id = store.list("normal").items[0].id;
  const blob = join(root, "normal", "blobs", `${id}.blob`);
  assert.deepEqual(await store.readBinary("normal", id), Buffer.alloc(0));
  await writeFile(join(root, "normal", "blobs", "notes.txt"), "unrelated");
  await store.remove("normal", id);
  assert.equal((await files(root)).includes(blob), false);
  assert.equal(
    (await readFile(join(root, "normal", "blobs", "notes.txt"))).toString(),
    "unrelated",
  );
});

test("missing referenced binary fails namespace load and preserves orphan evidence", async (t) => {
  const { root, store } = await fixture(t);
  await store.addBinary("normal", {
    kind: "file",
    name: "missing.bin",
    mime: "application/octet-stream",
    data: Buffer.from("missing"),
  });
  const id = store.list("normal").items[0].id;
  await rm(join(root, "normal", "blobs", `${id}.blob`));
  const orphan = join(
    root,
    "normal",
    "blobs",
    "00000000-0000-4000-8000-000000000000.blob",
  );
  await writeFile(orphan, "keep");
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, true);
  assert.equal((await readFile(orphan)).toString(), "keep");
});

test("cancels after blob persistence and before index rename, then cleans only the orphan on restart", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "committed");
  const before = store.list("normal");
  const result = await store.addBinary(
    "normal",
    {
      kind: "file",
      name: "cancel.bin",
      mime: "application/octet-stream",
      data: Buffer.from("cancelled bytes"),
    },
    () =>
      !readdirSync(join(root, "normal")).some(
        (name) => name.startsWith("index.enc.") && name.endsWith(".tmp"),
      ),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(store.list("normal"), before);
  assert.equal((await readdir(join(root, "normal", "blobs"))).length, 1);
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.deepEqual(next.list("normal"), before);
  assert.equal((await readdir(join(root, "normal", "blobs"))).length, 0);
});

test("normalizes Windows CRLF and lone CR to LF while preserving spaces and tabs", async (t) => {
  const { root, store } = await fixture(t);
  assert.equal(
    (await store.addText("normal", "first  line\r\nsecond\tline\rthird")).ok,
    true,
  );
  assert.equal(
    store.list("normal").items[0].text,
    "first  line\nsecond\tline\nthird",
  );
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(
    next.list("normal").items[0].text,
    "first  line\nsecond\tline\nthird",
  );
});

test("Windows directory fsync limitations do not turn a successful durable file replacement into an error", async (t) => {
  const { root, store } = await fixture(t);
  const handle = await open(join(root, "key.enc"), "r");
  const prototype = Object.getPrototypeOf(handle);
  const originalSync = prototype.sync;
  await handle.close();
  t.mock.method(
    prototype,
    "sync",
    async function (this: Awaited<ReturnType<typeof open>>) {
      if ((await this.stat()).isDirectory())
        throw Object.assign(new Error("unsupported directory fsync"), {
          code: "EPERM",
        });
      return originalSync.call(this);
    },
  );
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...descriptor, value: "win32" });
  try {
    assert.equal((await store.addText("normal", "Windows commit")).ok, true);
    assert.equal(store.list("normal").unavailable, false);
    const next = new ShelfStore(root, codec);
    await next.load();
    assert.equal(next.list("normal").items[0].text, "Windows commit");
  } finally {
    Object.defineProperty(process, "platform", descriptor);
    t.mock.restoreAll();
  }
});

test("bounds encrypted reads even when a file grows after the descriptor size check", async (t) => {
  const { root } = await fixture(t);
  const keyPath = join(root, "key.enc");
  const inode = (await lstat(keyPath)).ino;
  const handle = await open(keyPath, "r");
  const prototype = Object.getPrototypeOf(handle);
  const originalStat = prototype.stat;
  const originalRead = prototype.read;
  await handle.close();
  let grown = false;
  let readBytes = 0;
  let largestRequest = 0;
  t.mock.method(
    prototype,
    "stat",
    async function (this: Awaited<ReturnType<typeof open>>) {
      const info = await originalStat.call(this);
      if (info.ino === inode && !grown) {
        grown = true;
        await writeFile(keyPath, Buffer.alloc(128 * 1024, 65));
      }
      return info;
    },
  );
  t.mock.method(
    prototype,
    "read",
    async function (
      this: Awaited<ReturnType<typeof open>>,
      ...args: unknown[]
    ) {
      const result = await originalRead.apply(this, args);
      if ((await originalStat.call(this)).ino === inode) {
        readBytes += result.bytesRead;
        largestRequest = Math.max(
          largestRequest,
          typeof args[2] === "number"
            ? args[2]
            : (args[0] as Buffer).byteLength,
        );
      }
      return result;
    },
  );
  try {
    const next = new ShelfStore(root, codec);
    await next.load();
    assert.equal(next.list("normal").unavailable, true);
    assert.equal(grown, true);
    assert.ok(
      readBytes > 0 && readBytes <= 65537,
      "read at most the key limit plus one sentinel byte",
    );
    assert.ok(
      largestRequest <= 65536,
      "never allocate a read request from the growing file size",
    );
  } finally {
    t.mock.restoreAll();
  }
});

test("restarts a full shelf of maximum-size JSON-escaped texts without rejecting accepted data", async (t) => {
  const { root, store } = await fixture(t);
  const texts = Array.from({ length: 100 }, (_, index) =>
    (index % 2 ? "\\" : '"').repeat(64 * 1024),
  );
  for (const text of texts)
    assert.equal((await store.addText("normal", text)).ok, true);
  const before = store.list("normal");
  assert.equal(before.items.length, 100);
  assert.ok(
    (await lstat(join(root, "normal", "index.enc"))).size > 8 * 1024 * 1024,
  );
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.equal(next.list("normal").unavailable, false);
  assert.deepEqual(next.list("normal"), before);
});

test("URL hostnames consisting of dots retain their content without poisoning a healthy shelf", async (t) => {
  const { root, store } = await fixture(t);
  await store.addBinary("normal", {
    kind: "file",
    name: "before.bin",
    mime: "application/octet-stream",
    data: Buffer.from("keep existing"),
  });
  const id = store.list("normal").items[0].id;
  for (const text of ["https://.", "https://.."]) {
    assert.equal((await store.addText("normal", text)).ok, true);
    const snapshot = store.list("normal");
    assert.equal(snapshot.unavailable, false);
    assert.equal(snapshot.items[0].kind, "link");
    assert.equal(snapshot.items[0].text, text);
    assert.ok(
      snapshot.items[0].name && ![".", ".."].includes(snapshot.items[0].name),
    );
  }
  assert.equal(
    (await store.addText("normal", "subsequent valid content")).ok,
    true,
  );
  assert.deepEqual(
    await store.readBinary("normal", id),
    Buffer.from("keep existing"),
  );
  const next = new ShelfStore(root, codec);
  await next.load();
  assert.deepEqual(next.list("normal"), store.list("normal"));
});

test("index publication cannot succeed after cancellation wins the final event-loop boundary", async (t) => {
  const { root, store } = await fixture(t);
  await store.addText("normal", "preserve committed content");
  const index = join(root, "normal", "index.enc");
  const before = await readFile(index);
  let valid = true;
  let scheduled = false;
  let cancelledBeforePublication = false;
  // Delay an asynchronous rename's filesystem dispatch by one microtask, making
  // the vulnerable boundary deterministic instead of relying on disk timing.
  const rename = fsPromises.rename;
  t.mock.method(
    fsPromises,
    "rename",
    async (...args: Parameters<typeof rename>) => {
      await Promise.resolve();
      return rename(...args);
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const result = await store.addText("normal", "late mutation", () => {
    if (
      !scheduled &&
      readdirSync(join(root, "normal")).some(
        (name) => name.startsWith("index.enc.") && name.endsWith(".tmp"),
      )
    ) {
      scheduled = true;
      queueMicrotask(() => {
        // Cancel at the first event-loop boundary after the last guard. A commit
        // that already published synchronously has legitimately won the race.
        if (readFileSync(index).equals(before)) {
          cancelledBeforePublication = true;
          valid = false;
        }
      });
    }
    return valid;
  });
  assert.equal(scheduled, true, "exercise the final publication guard");
  assert.equal(
    result.ok && cancelledBeforePublication,
    false,
    "invalidated mutation must not report success",
  );
  const next = new ShelfStore(root, codec);
  await next.load();
  if (cancelledBeforePublication) {
    assert.equal(result.ok, false);
    assert.equal(next.list("normal").items.length, 1);
    assert.deepEqual(await readFile(index), before);
  } else {
    assert.equal(result.ok, true);
    assert.equal(next.list("normal").items.length, 2);
  }
});
