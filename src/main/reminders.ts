import { randomUUID } from "node:crypto";
import { renameSync } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ReplyReminder, ReminderSnapshot } from "../shared.ts";

export interface ReminderCodec {
  encrypt(text: string): string | Promise<string>;
  decrypt(encoded: string): string | Promise<string>;
}

type MutationGuard = () => boolean;
class CancelledMutation extends Error {
  constructor() {
    super("reminders-cancelled");
  }
}
function checkGuard(valid?: MutationGuard): void {
  if (valid && !valid()) throw new CancelledMutation();
}

const MAX_BYTES = 1_048_576;
const MAX_ITEMS = 500;
const MAX_DELAY = 366 * 86_400_000;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const unavailableMessage =
  "Chưa đọc hoặc lưu được nhắc việc. Dữ liệu hiện có được giữ; hãy mở lại Gom để thử lại.";
const controls =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const noteControls =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const storedId =
  /^rem_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_TIMESTAMP;
function accountId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 100 ||
    value.trim() !== value ||
    value.replace(controls, "") !== value
  )
    throw new Error("invalid-reminder-account");
  return value;
}
function note(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid-reminder-note");
  const clean = value.replace(/\r\n?/g, "\n").replace(noteControls, " ").trim();
  if (!clean || Array.from(clean).length > 500)
    throw new Error("invalid-reminder-note");
  return clean;
}
function time(value: unknown): number {
  if (!timestamp(value)) throw new Error("invalid-reminder-time");
  return value;
}
function future(value: unknown, now: number): number {
  time(now);
  if (!timestamp(value) || value <= now || value - now > MAX_DELAY)
    throw new Error("invalid-reminder-time");
  return value;
}
function reference(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 100)
    throw new Error("invalid-reminder-id");
  return value;
}
function parse(plaintext: string): ReplyReminder[] {
  if (typeof plaintext !== "string" || Buffer.byteLength(plaintext) > MAX_BYTES)
    throw new Error("invalid-reminders");
  const data: unknown = JSON.parse(plaintext);
  if (
    !isObject(data) ||
    data.version !== 1 ||
    !Array.isArray(data.items) ||
    data.items.length > MAX_ITEMS
  )
    throw new Error("invalid-reminders");
  const ids = new Set<string>();
  return data.items.map((raw: unknown): ReplyReminder => {
    if (
      !isObject(raw) ||
      typeof raw.id !== "string" ||
      !storedId.test(raw.id) ||
      ids.has(raw.id) ||
      !timestamp(raw.dueAt) ||
      !timestamp(raw.createdAt) ||
      (raw.completedAt !== null && !timestamp(raw.completedAt)) ||
      (raw.notifiedAt !== null && !timestamp(raw.notifiedAt))
    )
      throw new Error("invalid-reminders");
    const name = note(raw.note);
    if (name !== raw.note) throw new Error("invalid-reminders");
    ids.add(raw.id);
    return {
      id: raw.id,
      accountId: accountId(raw.accountId),
      note: name,
      dueAt: raw.dueAt,
      createdAt: raw.createdAt,
      completedAt: raw.completedAt,
      notifiedAt: raw.notifiedAt,
    };
  });
}

/** One main-process owner, with an injected OS-backed codec and no plaintext fallback. */
export class ReminderStore {
  private readonly path: string;
  private readonly codec: ReminderCodec;
  private items: ReplyReminder[] = [];
  private loaded = false;
  private unavailable = true;
  private error = "Chưa mở kho nhắc việc.";
  private tail: Promise<void> = Promise.resolve();
  private claimClock = 0;

  constructor(path: string, codec: ReminderCodec) {
    if (
      !codec ||
      typeof codec.encrypt !== "function" ||
      typeof codec.decrypt !== "function"
    )
      throw new Error("invalid-reminder-codec");
    this.path = path;
    this.codec = codec;
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const task = this.tail.then(work);
    this.tail = task.then(
      () => {},
      () => {},
    );
    return task;
  }
  private lock() {
    this.unavailable = true;
    this.error = unavailableMessage;
  }
  private ready() {
    if (!this.loaded) throw new Error("reminders-not-loaded");
    if (this.unavailable) throw new Error("reminders-unavailable");
  }
  load(): Promise<void> {
    return this.enqueue(async () => {
      if (this.loaded) return;
      this.loaded = true;
      let fileRead = false;
      try {
        if ((await stat(this.path)).size > MAX_BYTES)
          throw new Error("invalid-reminders");
        const bytes = await readFile(this.path);
        fileRead = true;
        if (bytes.byteLength > MAX_BYTES) throw new Error("invalid-reminders");
        const envelope: unknown = JSON.parse(bytes.toString("utf8"));
        if (
          !isObject(envelope) ||
          envelope.version !== 1 ||
          typeof envelope.data !== "string" ||
          !envelope.data
        )
          throw new Error("invalid-reminders");
        this.items = parse(await this.codec.decrypt(envelope.data));
        this.claimClock = this.items.reduce(
          (clock, item) => Math.max(clock, item.notifiedAt ?? 0),
          0,
        );
        this.unavailable = false;
        this.error = "";
      } catch (error) {
        if (!fileRead && (error as NodeJS.ErrnoException).code === "ENOENT") {
          this.unavailable = false;
          this.error = "";
        } else this.lock();
      }
    });
  }
  snapshot(): ReminderSnapshot {
    return {
      items: this.items.map((item) => ({ ...item })),
      unavailable: this.unavailable,
      error: this.error,
    };
  }
  private async encryptedEnvelope(
    items: ReplyReminder[],
    valid?: MutationGuard,
  ) {
    checkGuard(valid);
    const plain = JSON.stringify({ version: 1, items });
    if (Buffer.byteLength(plain) > MAX_BYTES)
      throw new Error("reminders-limit");
    let data: string;
    try {
      data = await this.codec.encrypt(plain);
      checkGuard(valid);
      if (typeof data !== "string" || !data || data === plain)
        throw new Error("invalid-reminder-ciphertext");
    } catch (error) {
      checkGuard(valid);
      if (error instanceof CancelledMutation) throw error;
      this.lock();
      throw new Error("reminders-write-failed");
    }
    const envelope = JSON.stringify({ version: 1, data });
    if (Buffer.byteLength(envelope) > MAX_BYTES)
      throw new Error("reminders-limit");
    return envelope;
  }
  private async persist(
    items: ReplyReminder[],
    valid?: MutationGuard,
    reserveCapacity = false,
  ) {
    if (reserveCapacity) {
      // OS encryption/base64 may expand plaintext. Measure through the real
      // codec with every mutable timestamp at its maximum encoded width, so
      // later claim/completion/rescheduling cannot exhaust accepted capacity.
      await this.encryptedEnvelope(
        items.map((item) => ({
          ...item,
          dueAt: MAX_TIMESTAMP,
          completedAt: MAX_TIMESTAMP,
          notifiedAt: MAX_TIMESTAMP,
        })),
        valid,
      );
    }
    const envelope = await this.encryptedEnvelope(items, valid);
    checkGuard(valid);
    const temporary = this.path + ".tmp";
    try {
      await mkdir(dirname(this.path), { recursive: true });
      checkGuard(valid);
      await writeFile(temporary, envelope, { mode: 0o600 });
      // No async boundary may separate the capability check and publication.
      checkGuard(valid);
      renameSync(temporary, this.path);
      this.items = items;
    } catch (error) {
      await unlink(temporary).catch(() => {});
      checkGuard(valid);
      if (error instanceof CancelledMutation) throw error;
      this.lock();
      throw new Error("reminders-write-failed");
    }
  }
  async add(
    input: { accountId: string; note: string; dueAt: number },
    now = Date.now(),
    valid?: MutationGuard,
  ): Promise<ReplyReminder> {
    const captured = {
      accountId: accountId(input?.accountId),
      note: note(input?.note),
      dueAt: future(input?.dueAt, now),
    };
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      if (this.items.length >= MAX_ITEMS) throw new Error("reminders-limit");
      const item: ReplyReminder = {
        id: "rem_" + randomUUID(),
        ...captured,
        createdAt: now,
        completedAt: null,
        notifiedAt: null,
      };
      await this.persist([...this.items, item], valid, true);
      return { ...item };
    });
  }
  async complete(
    id: string,
    now = Date.now(),
    valid?: MutationGuard,
  ): Promise<void> {
    const key = reference(id),
      at = time(now);
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      const item = this.items.find((item) => item.id === key);
      if (!item) throw new Error("reminder-not-found");
      if (item.completedAt !== null) return;
      await this.persist(
        this.items.map((item) =>
          item.id === key ? { ...item, completedAt: at } : item,
        ),
        valid,
      );
    });
  }
  async snooze(
    id: string,
    dueAt: number,
    now = Date.now(),
    valid?: MutationGuard,
  ): Promise<void> {
    const key = reference(id),
      due = future(dueAt, now);
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      if (!this.items.some((item) => item.id === key))
        throw new Error("reminder-not-found");
      await this.persist(
        this.items.map((item) =>
          item.id === key
            ? { ...item, dueAt: due, completedAt: null, notifiedAt: null }
            : item,
        ),
        valid,
      );
    });
  }
  async remove(id: string, valid?: MutationGuard): Promise<void> {
    const key = reference(id);
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      if (!this.items.some((item) => item.id === key)) return;
      await this.persist(
        this.items.filter((item) => item.id !== key),
        valid,
      );
    });
  }
  async claim(
    id: string,
    now = Date.now(),
    valid?: MutationGuard,
  ): Promise<ReplyReminder | null> {
    const key = reference(id),
      at = time(now);
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      const item = this.items.find((item) => item.id === key);
      if (
        !item ||
        item.completedAt !== null ||
        item.notifiedAt !== null ||
        item.dueAt > at
      )
        return null;
      const claimedAt = Math.max(at, this.claimClock + 1);
      if (!timestamp(claimedAt)) throw new Error("reminder-clock-exhausted");
      const claimed = { ...item, notifiedAt: claimedAt };
      await this.persist(
        this.items.map((item) => (item.id === key ? claimed : item)),
        valid,
      );
      this.claimClock = claimedAt;
      return { ...claimed };
    });
  }
  async releaseClaim(
    id: string,
    expectedNotifiedAt: number,
    valid?: MutationGuard,
  ): Promise<void> {
    const key = reference(id),
      expected = time(expectedNotifiedAt);
    return this.enqueue(async () => {
      this.ready();
      checkGuard(valid);
      const item = this.items.find((item) => item.id === key);
      if (!item || item.completedAt !== null || item.notifiedAt !== expected)
        return;
      await this.persist(
        this.items.map((item) =>
          item.id === key ? { ...item, notifiedAt: null } : item,
        ),
        valid,
      );
    });
  }
  flush(): Promise<void> {
    return this.tail;
  }
}
