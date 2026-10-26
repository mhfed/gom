import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { conversationKey, type ConversationRef } from "../../chat/model.ts";

/** Production must inject a keychain-backed codec; no plaintext fallback exists. */
export interface DraftCodec {
  encrypt(plaintext: string): Buffer | Promise<Buffer>;
  decrypt(ciphertext: Buffer): string | Promise<string>;
}

export interface DraftValue {
  /** null is a deletion tombstone; an empty string remains an ordinary draft. */
  text: string | null;
  revision: number;
}

export interface DraftLoadResult {
  writable: boolean;
  reason: "read-failed" | "decrypt-failed" | "invalid-data" | null;
}

type ErrorCode =
  | "invalid-codec"
  | "not-loaded"
  | "locked"
  | "invalid-revision"
  | "invalid-text"
  | "revision-conflict"
  | "revision-exhausted"
  | "write-failed";

export class DraftStoreError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = "DraftStoreError";
    this.code = code;
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function refFromKey(key: string): ConversationRef {
  const [accountId, conversationId, topicId] = JSON.parse(key);
  return topicId === null
    ? { accountId, conversationId }
    : { accountId, conversationId, topicId };
}

function parseRecords(plaintext: string): Map<string, DraftValue> {
  const payload = JSON.parse(plaintext);
  if (!payload || payload.version !== 1 || !Array.isArray(payload.entries))
    throw new Error("invalid-data");
  const records = new Map<string, DraftValue>();
  for (const entry of payload.entries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !validRevision(entry.revision) ||
      entry.revision === 0 ||
      (entry.text !== null && typeof entry.text !== "string")
    )
      throw new Error("invalid-data");
    const key = conversationKey(entry.ref);
    if (records.has(key)) throw new Error("invalid-data");
    records.set(key, { text: entry.text, revision: entry.revision });
  }
  return records;
}

/**
 * One main-process owner per path. Disk loads/writes are serialized; get() reads
 * the last committed snapshot. This is not a cross-process file lock. Deletion revisions are
 * retained indefinitely so a late send acknowledgement cannot clear a new draft.
 */
export class DraftStore {
  private readonly path: string;
  private readonly codec: DraftCodec;
  private records = new Map<string, DraftValue>();
  private loaded: DraftLoadResult | undefined;
  private tail: Promise<void> = Promise.resolve();

  constructor(path: string, codec: DraftCodec) {
    if (
      !codec ||
      typeof codec.encrypt !== "function" ||
      typeof codec.decrypt !== "function"
    )
      throw new DraftStoreError("invalid-codec");
    this.path = path;
    this.codec = codec;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /** Idempotent. A failed load stays locked for the lifetime of this instance. */
  load(): Promise<DraftLoadResult> {
    return this.enqueue(async () => {
      if (this.loaded) return { ...this.loaded };
      let bytes: Buffer;
      try {
        bytes = await readFile(this.path);
      } catch (error) {
        this.loaded =
          (error as NodeJS.ErrnoException).code === "ENOENT"
            ? { writable: true, reason: null }
            : { writable: false, reason: "read-failed" };
        return { ...this.loaded };
      }
      let plaintext: string;
      try {
        plaintext = await this.codec.decrypt(bytes);
      } catch {
        this.loaded = { writable: false, reason: "decrypt-failed" };
        return { ...this.loaded };
      }
      try {
        if (typeof plaintext !== "string") throw new Error("invalid-data");
        const records = parseRecords(plaintext);
        this.records = records;
        this.loaded = { writable: true, reason: null };
      } catch {
        this.loaded = { writable: false, reason: "invalid-data" };
      }
      return { ...this.loaded };
    });
  }

  private requireReady() {
    if (!this.loaded) throw new DraftStoreError("not-loaded");
    if (!this.loaded.writable) throw new DraftStoreError("locked");
  }

  get(ref: ConversationRef): DraftValue {
    const key = conversationKey(ref);
    this.requireReady();
    return { ...(this.records.get(key) ?? { text: null, revision: 0 }) };
  }

  async save(
    ref: ConversationRef,
    text: string,
    expectedRevision: number,
  ): Promise<DraftValue> {
    if (typeof text !== "string") throw new DraftStoreError("invalid-text");
    return this.update(conversationKey(ref), text, expectedRevision);
  }

  async remove(
    ref: ConversationRef,
    expectedRevision: number,
  ): Promise<DraftValue> {
    return this.update(conversationKey(ref), null, expectedRevision);
  }

  private update(
    key: string,
    text: string | null,
    expectedRevision: number,
  ): Promise<DraftValue> {
    if (!validRevision(expectedRevision))
      return Promise.reject(new DraftStoreError("invalid-revision"));
    return this.enqueue(async () => {
      this.requireReady();
      const prior = this.records.get(key) ?? { text: null, revision: 0 };
      if (prior.revision !== expectedRevision)
        throw new DraftStoreError("revision-conflict");
      if (prior.text === text) return { ...prior };
      if (prior.revision === Number.MAX_SAFE_INTEGER)
        throw new DraftStoreError("revision-exhausted");
      const value = { text, revision: prior.revision + 1 };
      const next = new Map(this.records);
      next.set(key, value);
      await this.persist(next);
      return { ...value };
    });
  }

  private async persist(next: Map<string, DraftValue>): Promise<void> {
    const directory = dirname(this.path);
    let temporary: string | undefined;
    try {
      const plaintext = JSON.stringify({
        version: 1,
        entries: [...next].map(([key, value]) => ({
          ref: refFromKey(key),
          ...value,
        })),
      });
      const encrypted = await this.codec.encrypt(plaintext);
      if (!Buffer.isBuffer(encrypted) || encrypted.length === 0)
        throw new Error("invalid-ciphertext");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const candidate = join(
        directory,
        `.${basename(this.path)}.${randomUUID()}.tmp`,
      );
      const file = await open(candidate, "wx", 0o600);
      temporary = candidate;
      try {
        await file.writeFile(encrypted);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.path);
      temporary = undefined;
    } catch {
      if (temporary) await unlink(temporary).catch(() => {});
      throw new DraftStoreError("write-failed");
    }

    // Rename is the commit point. Never reject as though a committed write had
    // rolled back if this filesystem cannot sync its directory afterwards.
    this.records = next;
    try {
      const handle = await open(directory, "r");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch {
      // File data was synced before the atomic rename; directory sync is best
      // effort on filesystems which do not support it.
    }
  }
}
