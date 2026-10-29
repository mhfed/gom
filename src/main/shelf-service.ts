import { constants, renameSync } from "node:fs";
import { lstat, open, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  SHELF_LIMITS,
  type ShelfItem,
  type ShelfRequest,
  type ShelfResult,
  type ShelfSummary,
} from "../shelf-types.ts";
import type { ShelfStore, ShelfNamespace } from "./shelf-store.ts";

export interface ShelfContext {
  space: ShelfNamespace;
  epoch: number;
  live: boolean;
}
export interface ShelfEnvironment {
  current(): ShelfContext;
  readClipboard(): Promise<
    { kind: "text"; text: string } | { kind: "image"; data: Buffer } | null
  >;
  writeClipboard(item: ShelfItem, data?: Buffer): Promise<void>;
  pickFiles(): Promise<string[] | undefined>;
  saveFile(name: string): Promise<string | undefined>;
  imagePreview(data: Buffer): Promise<Buffer | null>;
  onSurface(open: boolean): void;
  onChange(): void;
}
type Store = Pick<
  ShelfStore,
  | "list"
  | "addText"
  | "addBinary"
  | "pin"
  | "remove"
  | "clearUnpinned"
  | "readBinary"
>;
const stale = (): ShelfResult => ({
  ok: false,
  message: "Không gian đã thay đổi. Bạn thử lại trong khay đang mở.",
});
const invalid = (): ShelfResult => ({
  ok: false,
  message: "Thao tác khay chưa hợp lệ.",
});
const actions = new Set([
  "surface",
  "list",
  "add-text",
  "clipboard",
  "pick-files",
  "pin",
  "remove",
  "clear",
  "copy",
  "export",
  "preview",
]);
const keys = new Set(["action", "lockVersion", "id", "text", "pinned", "open"]);

// Read dimensions before asking the native image decoder to allocate pixels.
// Other formats remain ordinary files; only PNG/JPEG receive image treatment.
function imageInfo(data: Buffer): { mime: string; pixels: number } | null {
  if (
    data.length >= 33 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR"
  ) {
    const width = data.readUInt32BE(16),
      height = data.readUInt32BE(20);
    return {
      mime: "image/png",
      pixels: width > 0 && height > 0 ? width * height : Infinity,
    };
  }
  if (data.length > 4 && data[0] === 255 && data[1] === 216) {
    let pos = 2;
    while (pos + 3 < data.length) {
      if (data[pos++] !== 255) return null;
      while (data[pos] === 255) pos++;
      const marker = data[pos++];
      if (marker === 217 || marker === 218) return null;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (pos + 2 > data.length) return null;
      const length = data.readUInt16BE(pos);
      if (length < 2 || pos + length > data.length) return null;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 7) return null;
        const height = data.readUInt16BE(pos + 3),
          width = data.readUInt16BE(pos + 5);
        return {
          mime: "image/jpeg",
          pixels: width > 0 && height > 0 ? width * height : Infinity,
        };
      }
      pos += length;
    }
  }
  return null;
}

async function selectedFile(path: string): Promise<Buffer> {
  if ((await lstat(path)).isSymbolicLink()) throw Error("symlink");
  const file = await open(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw Error("not-file");
    if (stat.size > SHELF_LIMITS.itemBytes) throw Error("too-large");
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await file.read(
        buffer,
        length,
        buffer.length - length,
        length,
      );
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length !== stat.size) throw Error("changed-file");
    return buffer.subarray(0, length);
  } finally {
    await file.close();
  }
}

function fileLabel(path: string): string {
  const name = basename(path.replaceAll("\\", "/")).replace(
    /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    "_",
  );
  let label = "";
  for (const character of name) {
    if (Buffer.byteLength(label + character) > 160) return `${label}…`;
    label += character;
  }
  return label || "Tệp";
}

function fileFailure(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return "Tệp không còn ở vị trí đã chọn.";
  if (code === "EACCES" || code === "EPERM") return "Chưa có quyền đọc tệp.";
  switch ((error as Error)?.message) {
    case "symlink":
      return "Không nhận liên kết đến tệp.";
    case "not-file":
      return "Cần chọn tệp thường, không chọn thư mục.";
    case "too-large":
      return "Tệp vượt giới hạn 50 MiB.";
    case "changed-file":
      return "Tệp đã thay đổi khi đang đọc. Bạn chọn lại tệp.";
    case "image":
      return "Ảnh chưa được hỗ trợ hoặc vượt giới hạn điểm ảnh.";
    default:
      return "Chưa đọc được tệp. Bạn kiểm tra và thử lại.";
  }
}

async function exportFile(
  path: string,
  data: Buffer,
  valid: () => boolean,
): Promise<boolean> {
  const name = basename(path);
  if (!name || name === "." || name === "..") throw Error("destination");
  try {
    const existing = await lstat(path);
    if (!existing.isFile() || existing.isSymbolicLink())
      throw Error("destination");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!valid()) return false;
  const temp = join(dirname(path), `.gom-export-${randomUUID()}`);
  try {
    const file = await open(temp, "wx", 0o600);
    try {
      await file.writeFile(data);
      await file.sync();
    } finally {
      await file.close();
    }
    if (!valid()) return false;
    // Linearize publication synchronously: no lock event can interleave between
    // the last capability check and replacing an existing user-selected file.
    renameSync(temp, path);
    return true;
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

export class ShelfService {
  private opened = false;
  private stopping = false;
  private readonly dialogAbort = new AbortController();
  private binaryTail: Promise<unknown> = Promise.resolve();
  private readonly store: Store;
  private readonly env: ShelfEnvironment;
  constructor(store: Store, env: ShelfEnvironment) {
    this.store = store;
    this.env = env;
  }
  close(): void {
    this.opened = false;
  }
  async shutdown(): Promise<void> {
    this.stopping = true;
    this.close();
    this.dialogAbort.abort();
    // Actual reads/writes must finish, including export's temporary-file cleanup.
    // Native dialogs have their own cancellable boundary and cannot hold quit open.
    await this.binaryTail;
  }
  private dialog<T>(pending: Promise<T>): Promise<T | undefined> {
    const signal = this.dialogAbort.signal;
    if (signal.aborted) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const cancel = () => resolve(undefined);
      signal.addEventListener("abort", cancel, { once: true });
      pending.then(resolve, reject).finally(() => {
        signal.removeEventListener("abort", cancel);
      });
    });
  }
  summary(): ShelfSummary {
    const snapshot = this.store.list(this.env.current().space);
    return {
      count: snapshot.items.length,
      totalBytes: snapshot.totalBytes,
      revision: snapshot.revision,
      unavailable: snapshot.unavailable,
      open: this.opened,
    };
  }
  private valid(context: ShelfContext): boolean {
    const current = this.env.current();
    return (
      !this.stopping &&
      current.live &&
      current.epoch === context.epoch &&
      current.space === context.space
    );
  }
  private binary(
    context: ShelfContext,
    task: () => Promise<ShelfResult>,
  ): Promise<ShelfResult> {
    const pending = this.binaryTail.then(() =>
      this.valid(context) ? task() : stale(),
    );
    this.binaryTail = pending.catch(() => {});
    return pending;
  }
  private async preview(data: Buffer): Promise<Buffer | null> {
    const info = imageInfo(data);
    if (
      !info ||
      info.pixels > SHELF_LIMITS.imagePixels ||
      data.length > SHELF_LIMITS.itemBytes
    )
      return null;
    const preview = await this.env.imagePreview(data);
    return preview && preview.length <= SHELF_LIMITS.previewBytes
      ? preview
      : null;
  }
  async handle(raw: unknown): Promise<ShelfResult> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
    const r = raw as ShelfRequest;
    if (
      Object.keys(raw).some((k) => !keys.has(k)) ||
      !actions.has(r.action) ||
      !Number.isSafeInteger(r.lockVersion)
    )
      return invalid();
    const context = { ...this.env.current() };
    if (this.stopping || !context.live || context.epoch !== r.lockVersion)
      return stale();
    const valid = () => this.valid(context);
    const respond = (result: ShelfResult) => (valid() ? result : stale());
    const changed = (result: ShelfResult) => {
      if (result.ok) this.env.onChange();
      return respond(result);
    };
    try {
      if (r.action === "surface") {
        if (typeof r.open !== "boolean") return invalid();
        this.opened = r.open;
        this.env.onSurface(r.open);
        return { ok: true };
      }
      if (r.action === "list")
        return { ok: true, snapshot: this.store.list(context.space) };
      const snapshot = this.store.list(context.space);
      if (snapshot.unavailable)
        return {
          ok: false,
          message: snapshot.error || "Chưa đọc được khay. Bạn thử mở lại Gom.",
        };
      if (r.action === "add-text") {
        if (typeof r.text !== "string") return invalid();
        return changed(await this.store.addText(context.space, r.text, valid));
      }
      if (r.action === "clear")
        return changed(await this.store.clearUnpinned(context.space, valid));
      if (r.action === "clipboard")
        return await this.binary(context, async () => {
          const input = await this.env.readClipboard();
          if (!valid()) return stale();
          if (!input)
            return {
              ok: false,
              message:
                "Chưa có chữ hoặc ảnh để thêm. Bạn sao chép nội dung rồi thử lại.",
            };
          if (input.kind === "text")
            return changed(
              await this.store.addText(context.space, input.text, valid),
            );
          const preview = await this.preview(input.data);
          if (!valid()) return stale();
          if (!preview)
            return {
              ok: false,
              message:
                "Ảnh chưa được hỗ trợ hoặc quá lớn. Bạn chọn ảnh PNG/JPEG nhỏ hơn 50 MB và 16 triệu điểm ảnh.",
            };
          return changed(
            await this.store.addBinary(
              context.space,
              {
                kind: "image",
                name: "Ảnh đã sao chép.png",
                mime: imageInfo(input.data)!.mime,
                data: input.data,
              },
              valid,
            ),
          );
        });
      if (r.action === "pick-files")
        return await this.binary(context, async () => {
          const paths = await this.dialog(this.env.pickFiles());
          if (!valid()) return stale();
          if (!paths?.length) return { ok: false, message: "Chưa chọn tệp." };
          if (paths.length > SHELF_LIMITS.pickerFiles)
            return { ok: false, message: "Bạn chọn tối đa 10 tệp mỗi lần." };
          let added = 0;
          const failures: string[] = [];
          for (const path of paths) {
            if (!valid()) return stale();
            try {
              const data = await selectedFile(path);
              if (!valid()) return stale();
              const image = imageInfo(data);
              if (image && !(await this.preview(data))) throw Error("image");
              if (!valid()) return stale();
              const result = await this.store.addBinary(
                context.space,
                {
                  kind: image ? "image" : "file",
                  name: basename(path),
                  mime: image?.mime || "application/octet-stream",
                  data,
                },
                valid,
              );
              if (!valid()) return stale();
              if (result.ok) added++;
              else
                failures.push(
                  `${fileLabel(path)}: ${result.message || "Chưa lưu được tệp vào khay."}`,
                );
            } catch (error) {
              if (!valid()) return stale();
              failures.push(`${fileLabel(path)}: ${fileFailure(error)}`);
            }
          }
          if (added) this.env.onChange();
          return respond({
            ok: added > 0,
            snapshot: this.store.list(context.space),
            message: failures.length
              ? `Đã thêm ${added} tệp; ${failures.length} tệp chưa thêm được.\n${failures.join("\n")}`
              : `Đã thêm ${added} tệp.`,
          });
        });
      if (typeof r.id !== "string") return invalid();
      const item = snapshot.items.find((x) => x.id === r.id);
      if (!item)
        return { ok: false, message: "Mục không còn trong khay đang mở." };
      if (r.action === "pin") {
        if (typeof r.pinned !== "boolean") return invalid();
        return changed(
          await this.store.pin(context.space, item.id, r.pinned, valid),
        );
      }
      if (r.action === "remove")
        return changed(await this.store.remove(context.space, item.id, valid));
      if (
        r.action === "copy" ||
        r.action === "preview" ||
        r.action === "export"
      )
        return await this.binary(context, async () => {
          if (
            r.action === "copy" &&
            (item.kind === "text" || item.kind === "link")
          ) {
            if (!valid()) return stale();
            await this.env.writeClipboard(item);
            return respond({ ok: true, message: "Đã sao chép." });
          }
          if (item.kind !== "image" && item.kind !== "file") return invalid();
          if (r.action === "copy" && item.kind === "file") return invalid();
          if (r.action === "preview" && item.kind !== "image") return invalid();
          const data = await this.store.readBinary(context.space, item.id);
          if (!valid()) return stale();
          if (!data)
            return { ok: false, message: "Chưa đọc được nội dung mục này." };
          if (r.action === "preview") {
            const png = await this.preview(data);
            if (!valid()) return stale();
            return png
              ? {
                  ok: true,
                  dataUrl: `data:image/png;base64,${png.toString("base64")}`,
                }
              : { ok: false, message: "Chưa xem được ảnh này." };
          }
          if (r.action === "copy") {
            if (!(await this.preview(data)))
              return { ok: false, message: "Chưa đọc được ảnh này." };
            if (!valid()) return stale();
            await this.env.writeClipboard(item, data);
            return respond({ ok: true, message: "Đã sao chép." });
          }
          const target = await this.dialog(this.env.saveFile(item.name));
          if (!valid()) return stale();
          if (!target) return { ok: false, message: "Chưa chọn nơi lưu." };
          const exported = await exportFile(target, data, valid);
          return exported
            ? respond({ ok: true, message: "Đã lưu bản sao." })
            : stale();
        });
      return invalid();
    } catch {
      return valid()
        ? {
            ok: false,
            message:
              "Chưa hoàn tất thao tác khay. Bạn kiểm tra dung lượng và thử lại.",
          }
        : stale();
    }
  }
}
