import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ShelfService,
  type ShelfEnvironment,
} from "../src/main/shelf-service.ts";
import type { ShelfItem, ShelfResult, ShelfTemplate } from "../src/shelf-types.ts";

async function fileSymlink(source: string, link: string): Promise<boolean> {
  try {
    await symlink(source, link);
    return true;
  } catch (error) {
    if (
      process.platform === "win32" &&
      ["EPERM", "EACCES", "ENOTSUP"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return false;
    throw error;
  }
}

function fixture() {
  let context = {
    space: "normal" as "normal" | "private",
    epoch: 1,
    live: true,
  };
  const records: Record<string, ShelfItem[]> = { normal: [], private: [] };
  const templates: Record<string, ShelfTemplate[]> = { normal: [], private: [] };
  const payloads = new Map<string, Buffer>();
  let sequence = 0;
  const snapshot = (space: string) => ({
    items: records[space].map((x) => ({ ...x })),
    templates: templates[space].map((x) => ({ ...x })),
    totalBytes: records[space].reduce((n, x) => n + x.bytes, 0),
    revision: sequence,
    unavailable: false,
    error: "",
  });
  const add = async (
    space: string,
    item: Omit<ShelfItem, "id" | "createdAt" | "pinned">,
    valid = () => true,
  ): Promise<ShelfResult> => {
    if (!valid()) return { ok: false };
    records[space].push({
      ...item,
      id: String(++sequence),
      createdAt: sequence,
      pinned: false,
    });
    return { ok: true, snapshot: snapshot(space) };
  };
  const store = {
    list: snapshot,
    addText: (space: string, text: string, valid?: () => boolean) =>
      add(
        space,
        {
          kind: "text",
          name: "Nội dung",
          text,
          bytes: Buffer.byteLength(text),
          mime: "text/plain",
        },
        valid,
      ),
    addBinary: async (
      space: string,
      input: {
        kind: "image" | "file";
        name: string;
        mime: string;
        data: Buffer;
      },
      valid?: () => boolean,
    ) => {
      const r = await add(
        space,
        {
          kind: input.kind,
          name: input.name,
          bytes: input.data.length,
          mime: input.mime,
        },
        valid,
      );
      if (r.ok) payloads.set(String(sequence), Buffer.from(input.data));
      return r;
    },
    readBinary: async (space: string, id: string) =>
      records[space].some((x) => x.id === id)
        ? Buffer.from(payloads.get(id) ?? [])
        : null,
    pin: async () => ({ ok: false }),
    remove: async () => ({ ok: false }),
    clearUnpinned: async () => ({ ok: false }),
    addTemplate: async (
      space: string,
      input: { title: string; body: string },
      valid = () => true,
    ): Promise<ShelfResult> => {
      if (!valid()) return { ok: false };
      const now = ++sequence;
      templates[space].push({
        id: `template-${now}`,
        ...input,
        createdAt: now,
        updatedAt: now,
      });
      return { ok: true, snapshot: snapshot(space) };
    },
    updateTemplate: async (
      space: string,
      id: string,
      input: { title: string; body: string },
      valid = () => true,
    ): Promise<ShelfResult> => {
      if (!valid()) return { ok: false };
      const template = templates[space].find((item) => item.id === id);
      if (!template) return { ok: false };
      Object.assign(template, input, { updatedAt: ++sequence });
      return { ok: true, snapshot: snapshot(space) };
    },
    removeTemplate: async (
      space: string,
      id: string,
      valid = () => true,
    ): Promise<ShelfResult> => {
      if (!valid()) return { ok: false };
      const index = templates[space].findIndex((item) => item.id === id);
      if (index < 0) return { ok: false };
      templates[space].splice(index, 1);
      return { ok: true, snapshot: snapshot(space) };
    },
  };
  const clipboard: { text?: string; data?: Buffer }[] = [];
  const templateClipboard: string[] = [];
  let picked: string[] = [];
  let destination: string | undefined;
  let clipboardReads = 0;
  let reader: ShelfEnvironment["readClipboard"] = async () => ({
    kind: "text",
    text: "hello\nthere",
  });
  let picker: ShelfEnvironment["pickFiles"] = async () => picked;
  let imageCalls = 0;
  const env: ShelfEnvironment = {
    current: () => context,
    readClipboard: () => {
      clipboardReads++;
      return reader();
    },
    writeClipboard: async (item, data) => {
      clipboard.push(item.text !== undefined ? { text: item.text } : { data });
    },
    writeText: (text) => templateClipboard.push(text),
    pickFiles: () => picker(),
    saveFile: async () => destination,
    imagePreview: async () => {
      imageCalls++;
      return Buffer.from("preview");
    },
    onSurface: () => {},
    onChange: () => {},
  };
  const service = new ShelfService(store, env);
  const request = (action: string, extra = {}) =>
    service.handle({ action, lockVersion: context.epoch, ...extra });
  return {
    service,
    request,
    store,
    records,
    templates,
    clipboard,
    templateClipboard,
    clipboardReads: () => clipboardReads,
    context,
    env,
    setReader: (r: typeof reader) => (reader = r),
    setPicker: (p: typeof picker) => (picker = p),
    setPicked: (p: string[]) => (picked = p),
    setDestination: (p: string) => (destination = p),
    imageCalls: () => imageCalls,
  };
}

test("shelf template requests validate fields, support CRUD, and copy only the stored body on demand", async () => {
  const f = fixture();
  assert.equal(
    (await f.request("add-template", { title: "Trả lời", body: "Xin chào" })).ok,
    true,
  );
  const id = f.templates.normal[0].id;
  assert.equal(
    (
      await f.request("add-template", {
        title: "Thiếu nội dung",
        extra: "unexpected",
      })
    ).ok,
    false,
  );
  assert.equal(
    (await f.request("update-template", { templateId: id, title: "Thiếu body" })).ok,
    false,
  );
  const update = await f.request("update-template", {
    templateId: id,
    title: "Trả lời mới",
    body: "Xin chào\nDòng tiếp theo",
  });
  assert.equal(update.ok, true);
  assert.equal(update.snapshot?.templates[0].title, "Trả lời mới");
  assert.equal(update.snapshot?.templates[0].body, "Xin chào\nDòng tiếp theo");
  const readsBeforeCopy = f.clipboardReads();
  const copied = await f.request("copy-template", { templateId: id });
  assert.equal(copied.ok, true);
  assert.deepEqual(f.templateClipboard, ["Xin chào\nDòng tiếp theo"]);
  assert.deepEqual(f.clipboard, []);
  assert.equal(f.clipboardReads(), readsBeforeCopy);
  assert.equal(
    (await f.request("copy-template", { templateId: id, text: "override" })).ok,
    false,
  );
  assert.equal((await f.request("remove-template", { templateId: id })).ok, true);
  assert.deepEqual((await f.request("list")).snapshot?.templates, []);
});

test("template IDs cannot cross namespaces and missing copies reveal no template data", async () => {
  const f = fixture();
  await f.request("add-template", {
    title: "Bí mật khách hàng",
    body: "Nội dung riêng tư",
  });
  const id = f.templates.normal[0].id;
  f.context.space = "private";
  f.context.epoch++;
  const result = await f.request("copy-template", { templateId: id });
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /Bí mật khách hàng|Nội dung riêng tư/);
  assert.deepEqual(f.templateClipboard, []);
  assert.equal((await f.request("remove-template", { templateId: id })).ok, false);
  assert.deepEqual((await f.request("list")).snapshot?.templates, []);
});

test("a queued template copy is cancelled after the privacy epoch changes", async () => {
  const f = fixture();
  await f.request("add-template", {
    title: "Mẫu kín",
    body: "Không được sao chép sau khi khóa",
  });
  const id = f.templates.normal[0].id;
  let finish!: (value: { kind: "text"; text: string }) => void;
  f.setReader(() => new Promise((resolve) => (finish = resolve)));
  const blocker = f.request("clipboard");
  await new Promise((resolve) => setImmediate(resolve));
  const copy = f.request("copy-template", { templateId: id });
  await new Promise((resolve) => setImmediate(resolve));
  f.context.epoch++;
  f.context.space = "private";
  finish({ kind: "text", text: "unused" });
  assert.equal((await blocker).ok, false);
  const result = await copy;
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /Mẫu kín|Không được sao chép/);
  assert.deepEqual(f.templateClipboard, []);
});

test("shelf rejects stale and malformed requests without exposing namespace contents", async () => {
  const f = fixture();
  await f.request("add-text", { text: "normal-only" });
  assert.equal(
    (await f.service.handle({ action: "list", lockVersion: 0 })).ok,
    false,
  );
  assert.equal(
    (
      await f.service.handle({
        action: "list",
        lockVersion: 1,
        space: "private",
        path: "/etc/passwd",
      })
    ).ok,
    false,
  );
  f.context.space = "private";
  f.context.epoch++;
  const r = await f.request("list");
  assert.deepEqual(r.snapshot?.items, []);
  assert.equal(f.service.summary().count, 0);
});

test("clipboard read finishing after switch-away-and-back cannot add or copy content", async () => {
  const f = fixture();
  let finish!: (v: { kind: "text"; text: string }) => void;
  f.setReader(() => new Promise((resolve) => (finish = resolve)));
  const reading = f.request("clipboard");
  await new Promise((resolve) => setImmediate(resolve));
  f.context.epoch += 2;
  finish({ kind: "text", text: "old secret" });
  assert.equal((await reading).ok, false);
  assert.equal(f.records.normal.length, 0);
  assert.equal(f.records.private.length, 0);
  assert.deepEqual(f.clipboard, []);
});

test("file picker cancelled by epoch cannot copy selected files into either shelf", async () => {
  const f = fixture();
  let finish!: (v: string[]) => void;
  f.setPicker(() => new Promise((resolve) => (finish = resolve)));
  const request = f.request("pick-files");
  await new Promise((resolve) => setImmediate(resolve));
  f.context.epoch++;
  f.context.space = "private";
  finish(["/does-not-exist"]);
  assert.equal((await request).ok, false);
  assert.equal(f.records.normal.length + f.records.private.length, 0);
});

test("selected regular files are independent copies and oversized batches are rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "gom-shelf-service-"));
  try {
    const source = join(root, "quote.txt");
    await writeFile(source, "original");
    const f = fixture();
    f.setPicked([source]);
    assert.equal((await f.request("pick-files")).ok, true);
    await writeFile(source, "changed");
    assert.equal(
      (await f.store.readBinary("normal", "1"))?.toString(),
      "original",
    );
    f.setPicked(Array.from({ length: 11 }, () => source));
    assert.equal((await f.request("pick-files")).ok, false);
    assert.equal(f.records.normal.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("selected symbolic links are rejected without adding their target bytes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "gom-shelf-symlink-"));
  try {
    const source = join(root, "quote.txt"),
      link = join(root, "link.txt");
    await writeFile(source, "original");
    if (!(await fileSymlink(source, link))) {
      t.skip("Windows runner does not permit file symlinks");
      return;
    }
    const f = fixture();
    f.setPicked([link]);
    assert.equal((await f.request("pick-files")).ok, false);
    assert.equal(f.records.normal.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("export cancellation preserves existing destination and successful export writes exact bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "gom-shelf-export-"));
  try {
    const f = fixture();
    const destination = join(root, "export.bin");
    await writeFile(destination, "keep");
    await f.store.addBinary("normal", {
      kind: "file",
      name: "a.bin",
      mime: "application/octet-stream",
      data: Buffer.from([0, 1, 255]),
    });
    f.setDestination(destination);
    let finish!: (v: string | undefined) => void;
    f.env.saveFile = () => new Promise((resolve) => (finish = resolve));
    const exporting = f.request("export", { id: "1" });
    await new Promise((resolve) => setImmediate(resolve));
    f.context.epoch += 2;
    finish(destination);
    assert.equal((await exporting).ok, false);
    assert.equal(await readFile(destination, "utf8"), "keep");
    f.env.saveFile = async () => destination;
    assert.equal((await f.request("export", { id: "1" })).ok, true);
    assert.deepEqual(await readFile(destination), Buffer.from([0, 1, 255]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("wrong-namespace copy and oversized PNG dimensions never reach clipboard or decoder", async () => {
  const f = fixture();
  await f.request("add-text", { text: "normal only" });
  f.context.space = "private";
  f.context.epoch++;
  assert.equal((await f.request("copy", { id: "1" })).ok, false);
  assert.deepEqual(f.clipboard, []);
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(100000, 16);
  png.writeUInt32BE(100000, 20);
  f.setReader(async () => ({ kind: "image", data: png }));
  assert.equal((await f.request("clipboard")).ok, false);
  assert.equal(f.imageCalls(), 0);
});

test("surface closes without stale re-open and text copy preserves LF/tab", async () => {
  const f = fixture();
  await f.request("surface", { open: true });
  assert.equal(f.service.summary().open, true);
  f.service.close();
  assert.equal(f.service.summary().open, false);
  f.context.epoch++;
  assert.equal(
    (await f.service.handle({ action: "surface", open: true, lockVersion: 1 }))
      .ok,
    false,
  );
  await f.request("add-text", { text: "hello\n\tworld" });
  await f.request("copy", { id: "1" });
  assert.deepEqual(f.clipboard, [{ text: "hello\n\tworld" }]);
});

test("shutdown cancels abandoned native dialogs, ignores late choices and rejects new work", async () => {
  for (const action of ["pick-files", "export"] as const) {
    const f = fixture();
    await f.store.addBinary("normal", {
      kind: "file",
      name: "abandoned.bin",
      mime: "application/octet-stream",
      data: Buffer.from("private bytes"),
    });
    let finish!: () => void;
    if (action === "pick-files")
      f.env.pickFiles = () =>
        new Promise((resolve) => {
          finish = () => resolve(["/late/secret"]);
        });
    else
      f.env.saveFile = () =>
        new Promise((resolve) => {
          finish = () => resolve("/late/secret");
        });
    const pending = f.request(action, { id: "1" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      typeof f.service.shutdown,
      "function",
      "service must own shutdown of pending binary work",
    );
    await Promise.race([
      f.service.shutdown(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(Error("shutdown waited for an abandoned dialog")),
          1000,
        ).unref(),
      ),
    ]);
    assert.equal((await pending).ok, false);
    assert.equal(
      (await f.request("add-text", { text: "after shutdown" })).ok,
      false,
    );
    assert.equal((await f.request("surface", { open: true })).ok, false);
    assert.equal(f.service.summary().open, false);
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.records.normal.length, 1);
    await f.service.shutdown();
  }
});

test("mixed file selection reports each safe basename and reason without paths or stale names", async () => {
  const root = await mkdtemp(join(tmpdir(), "gom-shelf-batch-"));
  try {
    const f = fixture();
    const good = join(root, "good.txt"),
      missing = join(root, "missing.txt"),
      link = join(root, "shortcut.txt"),
      quota = join(root, "quota.bin"),
      unsafe = join(root, "unsafe\nname.txt");
    await writeFile(good, "good");
    await writeFile(quota, "quota");
    // Windows cannot create a filename containing a newline. Still send the
    // hostile picker path to exercise safe labels and a per-file rejection.
    if (process.platform !== "win32") await writeFile(unsafe, "unsafe");
    const hasSymlink = await fileSymlink(good, link);
    // Keep the mixed batch active on runners without symlink privileges.
    if (!hasSymlink) await mkdir(link);
    const add = f.store.addBinary;
    f.store.addBinary = async (space, input, valid) =>
      input.name === "quota.bin"
        ? { ok: false, message: "Khay đã đầy. Hãy xóa mục trước khi thêm." }
        : input.name.includes("\n")
          ? { ok: false, message: "Tên hoặc loại tệp không hợp lệ." }
          : add(space, input, valid);
    const longName = "é".repeat(180) + ".txt";
    f.setPicked([good, missing, link, quota, unsafe, join(root, longName)]);
    const result = await f.request("pick-files");
    assert.equal(result.ok, true);
    assert.equal(result.snapshot?.items.length, 1);
    assert.equal(
      result.message!.split("\n").length,
      6,
      "all five rejected selections receive a reason",
    );
    assert.match(result.message!, /missing\.txt[^\n]*không còn/i);
    assert.match(
      result.message!,
      hasSymlink
        ? /shortcut\.txt[^\n]*liên kết/i
        : /shortcut\.txt[^\n]*(?:tệp thường|quyền đọc)/i,
    );
    assert.match(result.message!, /quota\.bin[^\n]*đầy/i);
    assert.match(
      result.message!,
      process.platform === "win32"
        ? /unsafe_name\.txt[^\n]*(?:không còn|chưa đọc được)/i
        : /unsafe_name\.txt[^\n]*không hợp lệ/i,
    );
    assert.equal(result.message!.includes(root), false);
    assert.equal(result.message!.includes("unsafe\nname.txt"), false);
    assert.equal(result.message!.includes(longName), false);
    assert.ok(
      Buffer.byteLength(result.message!) < 1800,
      "file labels and reasons are bounded",
    );
    const stale = fixture();
    stale.store.addBinary = async () => {
      stale.context.epoch++;
      return { ok: false, message: "old private filename" };
    };
    stale.setPicked([good]);
    const cancelled = await stale.request("pick-files");
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.message!.includes("good.txt"), false);
    assert.equal(cancelled.message!.includes("old private filename"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
