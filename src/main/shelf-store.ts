import { constants, renameSync } from "node:fs";
import { mkdir, readdir, open, unlink, lstat } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  SHELF_LIMITS,
  type ShelfItem,
  type ShelfResult,
  type ShelfSnapshot,
} from "../shelf-types.ts";

export type ShelfNamespace = "normal" | "private";
export interface ShelfKeyCodec {
  available(): Promise<boolean>;
  encrypt(text: string): Promise<string>;
  decrypt(encoded: string): Promise<string>;
}
type Guard = () => boolean;
type State = {
  items: ShelfItem[];
  revision: number;
  unavailable: boolean;
  error: string;
};
type Index = { version: 1; revision: number; items: ShelfItem[] };
const spaces: ShelfNamespace[] = ["normal", "private"];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const unsafeText =
  /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const unsafeName = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const mimePattern = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/;
const maxNameBytes = 255;
const maxMimeLength = 127;
const envelopeBytes = 4 + 12 + 16;
// JSON uses at most six encoded bytes per UTF-8 input byte (including lone
// surrogates). Include every bounded string, fixed field, maximum-width number,
// array comma and the AEAD header so any valid full shelf fits after restart.
const maxFixedItemBytes = Buffer.byteLength(
  JSON.stringify({
    id: "f".repeat(36),
    kind: "image",
    createdAt: Number.MAX_SAFE_INTEGER,
    pinned: false,
    name: "",
    bytes: Number.MAX_SAFE_INTEGER,
    mime: "",
    text: "",
  }),
);
const maxEncodedIndexBytes =
  envelopeBytes +
  Buffer.byteLength(
    JSON.stringify({
      version: 1,
      revision: Number.MAX_SAFE_INTEGER,
      items: [],
    }),
  ) +
  SHELF_LIMITS.items *
    (maxFixedItemBytes +
      1 +
      6 * (SHELF_LIMITS.textBytes + maxNameBytes + maxMimeLength));

const errorMessage =
  "Chưa đọc hoặc lưu được Khay. Dữ liệu đã lưu được giữ nguyên.";
const cancelledMessage = "Thao tác đã bị hủy vì không gian đã thay đổi.";
class Cancelled extends Error {}
function check(valid: Guard) {
  if (!valid()) throw new Cancelled();
}
function validSpace(space: ShelfNamespace): boolean {
  return spaces.includes(space);
}
function binary(item: ShelfItem) {
  return item.kind === "image" || item.kind === "file";
}
function safeName(name: string): string | null {
  if (typeof name !== "string" || name.length > 1024 || unsafeName.test(name))
    return null;
  const result = basename(name.replaceAll("\\", "/")).trim();
  return result &&
    result !== "." &&
    result !== ".." &&
    Buffer.byteLength(result) <= maxNameBytes
    ? result
    : null;
}
function validMime(mime: string) {
  return (
    typeof mime === "string" &&
    mime.length <= maxMimeLength &&
    mimePattern.test(mime)
  );
}
function link(text: string): boolean {
  try {
    const value = new URL(text);
    return (
      !/\s/.test(text) &&
      (value.protocol === "http:" || value.protocol === "https:")
    );
  } catch {
    return false;
  }
}
function total(items: ShelfItem[]) {
  return items.reduce((sum, item) => sum + item.bytes, 0);
}
function validateIndex(value: unknown): Index {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error();
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).sort().join() !== "items,revision,version" ||
    data.version !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    (data.revision as number) < 0 ||
    !Array.isArray(data.items) ||
    data.items.length > SHELF_LIMITS.items
  )
    throw new Error();
  const ids = new Set<string>();
  for (const raw of data.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error();
    const item = raw as ShelfItem;
    const keys = Object.keys(item).sort().join();
    if (
      keys !==
        (binary(item)
          ? "bytes,createdAt,id,kind,mime,name,pinned"
          : "bytes,createdAt,id,kind,mime,name,pinned,text") ||
      typeof item.id !== "string" ||
      !uuid.test(item.id) ||
      ids.has(item.id) ||
      !["text", "link", "image", "file"].includes(item.kind) ||
      !Number.isSafeInteger(item.createdAt) ||
      item.createdAt <= 0 ||
      typeof item.pinned !== "boolean" ||
      safeName(item.name) !== item.name ||
      !validMime(item.mime) ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 0 ||
      item.bytes > SHELF_LIMITS.itemBytes
    )
      throw new Error();
    if (
      !binary(item) &&
      (typeof item.text !== "string" ||
        !item.text.trim() ||
        unsafeText.test(item.text) ||
        Buffer.byteLength(item.text) !== item.bytes ||
        item.bytes > SHELF_LIMITS.textBytes ||
        item.mime !== "text/plain" ||
        (item.kind === "link") !== link(item.text))
    )
      throw new Error();
    ids.add(item.id);
  }
  if (total(data.items) > SHELF_LIMITS.totalBytes) throw new Error();
  return data as Index;
}

export class ShelfStore {
  private readonly root: string;
  private readonly codec: ShelfKeyCodec;
  private key: Buffer | null = null;
  private states: Record<ShelfNamespace, State> = {
    normal: { items: [], revision: 0, unavailable: true, error: errorMessage },
    private: { items: [], revision: 0, unavailable: true, error: errorMessage },
  };
  private queue: Promise<void> = Promise.resolve();
  private loading: Promise<void> | null = null;
  constructor(root: string, codec: ShelfKeyCodec) {
    this.root = root;
    this.codec = codec;
  }

  load(): Promise<void> {
    if (!this.loading)
      this.loading = this.serial(async () => {
        try {
          if (!(await this.codec.available())) throw new Error();
          await this.directory(this.root);
          const keyPath = join(this.root, "key.enc");
          let wrapped: Buffer;
          try {
            wrapped = await this.readFile(keyPath, 64 * 1024);
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "ENOENT" ||
              (await readdir(this.root)).length !== 0
            )
              throw error;
            const key = randomBytes(32);
            const encoded = await this.codec.encrypt(key.toString("base64"));
            if (
              typeof encoded !== "string" ||
              !encoded ||
              Buffer.byteLength(encoded) > 64 * 1024
            )
              throw new Error();
            await this.atomic(keyPath, Buffer.from(encoded), () => true);
            wrapped = Buffer.from(encoded);
          }
          const decoded = await this.codec.decrypt(wrapped.toString("utf8"));
          if (!/^[A-Za-z0-9+/]{43}=$/.test(decoded)) throw new Error();
          this.key = Buffer.from(decoded, "base64");
          if (this.key.length !== 32) throw new Error();
          for (const space of spaces) await this.loadSpace(space);
        } catch {
          this.key = null;
          for (const space of spaces) this.fail(space);
        }
      });
    return this.loading;
  }

  list(space: ShelfNamespace): ShelfSnapshot {
    if (!validSpace(space))
      return {
        items: [],
        totalBytes: 0,
        revision: 0,
        unavailable: true,
        error: errorMessage,
      };
    const state = this.states[space];
    return {
      items: state.items
        .map((item) => ({ ...item }))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.createdAt - a.createdAt ||
            b.id.localeCompare(a.id),
        ),
      totalBytes: total(state.items),
      revision: state.revision,
      unavailable: state.unavailable,
      error: state.error,
    };
  }

  addText(
    space: ShelfNamespace,
    text: string,
    valid: Guard = () => true,
  ): Promise<ShelfResult> {
    return this.mutate(space, valid, async (items) => {
      if (typeof text === "string") text = text.replace(/\r\n?/g, "\n");
      if (
        typeof text !== "string" ||
        !text.trim() ||
        unsafeText.test(text) ||
        Buffer.byteLength(text) > SHELF_LIMITS.textBytes
      )
        return "Nội dung chữ không hợp lệ hoặc vượt 64 KiB.";
      const isLink = link(text);
      const name = isLink
        ? (safeName(new URL(text).hostname.slice(0, 200)) ?? "Liên kết")
        : "Đoạn chữ";
      items.push({
        id: randomUUID(),
        kind: isLink ? "link" : "text",
        createdAt: this.timestamp(items),
        pinned: false,
        name,
        mime: "text/plain",
        bytes: Buffer.byteLength(text),
        text,
      });
    });
  }

  addBinary(
    space: ShelfNamespace,
    input: { kind: "image" | "file"; name: string; mime: string; data: Buffer },
    valid: Guard = () => true,
  ): Promise<ShelfResult> {
    // Snapshot caller-owned bytes before waiting in the mutation queue.
    if (
      !input ||
      !Buffer.isBuffer(input.data) ||
      input.data.length > SHELF_LIMITS.itemBytes
    )
      return Promise.resolve({
        ok: false,
        message: "Tệp hoặc ảnh vượt giới hạn 50 MiB.",
      });
    const saved = { ...input, data: Buffer.from(input.data) };
    return this.mutate(space, valid, async (items) => {
      const name = safeName(saved.name);
      if (
        !name ||
        !validMime(saved.mime) ||
        !["image", "file"].includes(saved.kind)
      )
        return "Tên hoặc loại tệp không hợp lệ.";
      if (
        items.length >= SHELF_LIMITS.items ||
        total(items) + saved.data.length > SHELF_LIMITS.totalBytes
      )
        return "Khay đã đầy. Hãy xóa mục trước khi thêm.";
      const id = randomUUID();
      await this.atomic(
        this.blobPath(space, id),
        this.encrypt(space, id, saved.data),
        valid,
      );
      check(valid);
      items.push({
        id,
        kind: saved.kind,
        createdAt: this.timestamp(items),
        pinned: false,
        name,
        mime: saved.mime,
        bytes: saved.data.length,
      });
    });
  }

  pin(
    space: ShelfNamespace,
    id: string,
    pinned: boolean,
    valid: Guard = () => true,
  ): Promise<ShelfResult> {
    return this.mutate(space, valid, async (items) => {
      const item = items.find((item) => item.id === id);
      if (!item || typeof pinned !== "boolean")
        return "Không tìm thấy mục trong Khay.";
      item.pinned = pinned;
    });
  }
  remove(
    space: ShelfNamespace,
    id: string,
    valid: Guard = () => true,
  ): Promise<ShelfResult> {
    return this.mutate(space, valid, async (items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return "Không tìm thấy mục trong Khay.";
      items.splice(index, 1);
    });
  }
  clearUnpinned(
    space: ShelfNamespace,
    valid: Guard = () => true,
  ): Promise<ShelfResult> {
    return this.mutate(space, valid, async (items) => {
      for (let index = items.length - 1; index >= 0; index--)
        if (!items[index].pinned) items.splice(index, 1);
    });
  }

  readBinary(space: ShelfNamespace, id: string): Promise<Buffer | null> {
    return this.serial(async () => {
      if (
        !validSpace(space) ||
        this.states[space].unavailable ||
        !uuid.test(id)
      )
        return null;
      const item = this.states[space].items.find((item) => item.id === id);
      if (!item || !binary(item)) return null;
      try {
        const bytes = this.decrypt(
          space,
          id,
          await this.readFile(
            this.blobPath(space, id),
            SHELF_LIMITS.itemBytes + 32,
          ),
        );
        if (bytes.length !== item.bytes) throw new Error();
        return bytes;
      } catch {
        this.fail(space);
        return null;
      }
    });
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private timestamp(items: ShelfItem[]) {
    return Math.max(Date.now(), ...items.map((item) => item.createdAt + 1));
  }
  private fail(space: ShelfNamespace) {
    this.states[space].unavailable = true;
    this.states[space].error = errorMessage;
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  private mutate(
    space: ShelfNamespace,
    valid: Guard,
    action: (items: ShelfItem[]) => Promise<string | void>,
  ): Promise<ShelfResult> {
    return this.serial(async () => {
      if (!validSpace(space) || this.states[space].unavailable || !this.key)
        return { ok: false, message: errorMessage };
      try {
        check(valid);
        const state = this.states[space];
        const items = state.items.map((item) => ({ ...item }));
        const message = await action(items);
        if (message) return { ok: false, message };
        if (
          items.length > SHELF_LIMITS.items ||
          total(items) > SHELF_LIMITS.totalBytes
        )
          return {
            ok: false,
            message: "Khay đã đầy. Hãy xóa mục trước khi thêm.",
          };
        check(valid);
        const index: Index = {
          version: 1,
          revision: state.revision + 1,
          items,
        };
        validateIndex(index);
        await this.atomic(
          join(this.root, space, "index.enc"),
          this.encodeIndex(space, index),
          valid,
        );
        this.states[space] = {
          items,
          revision: index.revision,
          unavailable: false,
          error: "",
        };
        await this.cleanup(space).catch(() => undefined);
        return { ok: true, snapshot: this.list(space) };
      } catch (error) {
        if (error instanceof Cancelled)
          return { ok: false, message: cancelledMessage };
        this.fail(space);
        return { ok: false, message: errorMessage };
      }
    });
  }
  private async loadSpace(space: ShelfNamespace): Promise<void> {
    try {
      const dir = join(this.root, space);
      const existed = await lstat(dir).then(
        () => true,
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
          return false;
        },
      );
      await this.directory(dir);
      await this.directory(join(dir, "blobs"));
      let bytes: Buffer;
      try {
        bytes = await this.readFile(
          join(dir, "index.enc"),
          maxEncodedIndexBytes,
        );
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "ENOENT" ||
          existed ||
          (await readdir(join(dir, "blobs"))).length !== 0 ||
          (await readdir(dir)).some((name) => name !== "blobs")
        )
          throw error;
        bytes = this.encodeIndex(space, { version: 1, revision: 0, items: [] });
        await this.atomic(join(dir, "index.enc"), bytes, () => true);
      }
      const index = validateIndex(
        JSON.parse(this.decrypt(space, "index", bytes).toString("utf8")),
      );
      // Check referenced originals before treating the namespace as healthy or deleting any orphans.
      for (const item of index.items) {
        if (binary(item)) {
          const data = this.decrypt(
            space,
            item.id,
            await this.readFile(
              this.blobPath(space, item.id),
              SHELF_LIMITS.itemBytes + 32,
            ),
          );
          if (data.length !== item.bytes) throw new Error();
        }
      }
      this.states[space] = {
        items: index.items,
        revision: index.revision,
        unavailable: false,
        error: "",
      };
      await this.cleanup(space).catch(() => undefined);
    } catch {
      this.fail(space);
    }
  }
  private encodeIndex(space: ShelfNamespace, index: Index): Buffer {
    const bytes = Buffer.from(JSON.stringify(index));
    if (bytes.length + envelopeBytes > maxEncodedIndexBytes) throw new Error();
    return this.encrypt(space, "index", bytes);
  }
  private blobPath(space: ShelfNamespace, id: string) {
    return join(this.root, space, "blobs", `${id}.blob`);
  }
  private encrypt(space: ShelfNamespace, id: string, bytes: Buffer): Buffer {
    if (!this.key) throw new Error();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(`gom-shelf:v1:${space}:${id}`));
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([
      Buffer.from("GS01"),
      nonce,
      cipher.getAuthTag(),
      encrypted,
    ]);
  }
  private decrypt(space: ShelfNamespace, id: string, bytes: Buffer): Buffer {
    if (
      !this.key ||
      bytes.length < 32 ||
      bytes.subarray(0, 4).toString() !== "GS01"
    )
      throw new Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(4, 16),
    );
    cipher.setAAD(Buffer.from(`gom-shelf:v1:${space}:${id}`));
    cipher.setAuthTag(bytes.subarray(16, 32));
    return Buffer.concat([cipher.update(bytes.subarray(32)), cipher.final()]);
  }
  private async directory(path: string) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error();
  }
  private async readFile(path: string, maxBytes: number): Promise<Buffer> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > maxBytes) throw new Error();
      const chunks: Buffer[] = [];
      let length = 0;
      // A file may grow after fstat. Bound every read and the total bytes, rather
      // than asking readFile() to allocate according to a changing file size.
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1));
      while (length <= maxBytes) {
        const { bytesRead } = await file.read(
          chunk,
          0,
          Math.min(chunk.length, maxBytes + 1 - length),
          null,
        );
        if (!bytesRead) break;
        chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
        length += bytesRead;
      }
      if (length > maxBytes) throw new Error();
      return Buffer.concat(chunks, length);
    } finally {
      await file.close();
    }
  }
  private async atomic(
    path: string,
    bytes: Buffer,
    valid: Guard,
  ): Promise<void> {
    check(valid);
    const temp = `${path}.${randomUUID()}.tmp`;
    const file = await open(temp, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
      await file.close();
      check(valid);
      // Publish in the same event-loop turn as the final privacy guard.
      renameSync(temp, path);
      // Windows does not support opening/fsyncing directories through this API.
      // The file is fsynced before rename on every platform.
      if (process.platform !== "win32") {
        const directory = await open(join(path, ".."), constants.O_RDONLY);
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } catch (error) {
      await file.close().catch(() => undefined);
      await unlink(temp).catch(() => undefined);
      throw error;
    }
  }
  private async cleanup(space: ShelfNamespace): Promise<void> {
    if (this.states[space].unavailable) return;
    const keep = new Set(
      this.states[space].items.filter(binary).map((item) => `${item.id}.blob`),
    );
    const directory = join(this.root, space, "blobs");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ownedBlob =
        entry.name.endsWith(".blob") && uuid.test(entry.name.slice(0, -5));
      const ownedTemp = /^([0-9a-f-]{36})\.blob\.([0-9a-f-]{36})\.tmp$/.exec(
        entry.name,
      );
      if (
        (ownedBlob && !keep.has(entry.name)) ||
        (ownedTemp && uuid.test(ownedTemp[1]) && uuid.test(ownedTemp[2]))
      )
        await unlink(join(directory, entry.name));
    }
  }
}
