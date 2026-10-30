import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SleepStore, AccountSleepService } from "../src/main/account-sleep.ts";

test("sleep markers persist independently and reject corrupt metadata without overwriting it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gom-sleep-store-")),
    path = join(dir, "sleep.json");
  try {
    const store = new SleepStore(path);
    await store.load(new Set(["a", "b"]));
    assert.equal(await store.set("a", true), true);
    const restored = new SleepStore(path);
    await restored.load(new Set(["a", "b"]));
    assert.deepEqual(restored.snapshot(), ["a"]);
    await restored.set("a", false);
    assert.deepEqual(restored.snapshot(), []);
    await writeFile(path, '{"version":99,"sleeping":["a"]}');
    const corrupt = new SleepStore(path);
    await corrupt.load(new Set(["a"]));
    assert.equal(corrupt.unavailable, true);
    await assert.rejects(corrupt.set("a", true));
    assert.equal(
      await readFile(path, "utf8"),
      '{"version":99,"sleeping":["a"]}',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("failed sleep persistence leaves the prior state; cancellation never publishes prepared data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gom-sleep-write-")),
    path = join(dir, "sleep.json");
  try {
    const store = new SleepStore(path);
    await store.load(new Set(["a"]));
    await mkdir(path + ".tmp");
    await assert.rejects(store.set("a", true));
    assert.equal(store.has("a"), false);
    await rm(path + ".tmp", { recursive: true });
    let valid = true;
    const guarded = new SleepStore(path, async (temporaryPath, value) => {
      await writeFile(temporaryPath, JSON.stringify(value));
      valid = false;
    });
    await guarded.load(new Set(["a"]));
    assert.equal(await guarded.set("a", true, () => valid), false);
    assert.equal(guarded.has("a"), false);
    const saved = await readFile(path, "utf8").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return JSON.stringify({ sleeping: [] });
        throw error;
      },
    );
    assert.deepEqual(JSON.parse(saved).sleeping, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "gom-sleep-service-"));
  const store = new SleepStore(join(dir, "sleep.json"));
  await store.load(new Set(["a"]));
  const f = {
    epoch: 1,
    key: {} as object | undefined,
    allowed: true,
    block: "",
    confirmed: true,
    events: [] as string[],
    flush: async () => {},
    confirm: async () => true,
  };
  const service = new AccountSleepService({
    store,
    epoch: () => f.epoch,
    accessible: () => f.allowed,
    view: () => f.key,
    blocked: () => f.block,
    confirm: async () => f.confirm(),
    flush: async () => {
      f.events.push("flush");
      await f.flush();
    },
    close: () => {
      assert.equal(store.has("a"), true);
      f.events.push("close");
      f.key = undefined;
    },
    activate: () => {
      assert.equal(store.has("a"), false);
      f.events.push("activate");
      f.key = {};
    },
    changed: () => {},
  });
  return {
    ...f,
    f,
    store,
    service,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
test("sleep confirms and flushes before durable close, wake clears marker before recreating page", async () => {
  const x = await fixture();
  try {
    assert.equal((await x.service.sleep("a", 1)).ok, true);
    assert.deepEqual(x.f.events, ["flush", "close"]);
    assert.equal(x.store.has("a"), true);
    assert.equal((await x.service.wake("a", 1)).ok, true);
    assert.deepEqual(x.f.events, ["flush", "close", "activate"]);
  } finally {
    await x.cleanup();
  }
});
test("blocked or canceled sleep keeps page and persisted marker unchanged", async () => {
  const x = await fixture();
  try {
    x.f.block = "audio";
    assert.equal((await x.service.sleep("a", 1)).ok, false);
    x.f.block = "";
    x.f.confirm = async () => false;
    assert.equal((await x.service.sleep("a", 1)).ok, false);
    assert.deepEqual(x.f.events, []);
    assert.equal(x.store.has("a"), false);
  } finally {
    await x.cleanup();
  }
});
test("workspace or activation changes during flush win over sleep", async () => {
  for (const change of ["epoch", "activation", "block"]) {
    const x = await fixture();
    try {
      x.f.flush = async () => {
        if (change === "epoch") x.f.epoch++;
        else if (change === "activation") x.service.cancel("a");
        else x.f.block = "download";
      };
      assert.equal((await x.service.sleep("a", 1)).ok, false);
      assert.deepEqual(x.f.events, ["flush"]);
      assert.equal(x.store.has("a"), false);
    } finally {
      await x.cleanup();
    }
  }
});
test("late confirmation and failed flush cannot close the page", async () => {
  const x = await fixture();
  try {
    x.f.confirm = async () => {
      x.f.allowed = false;
      return true;
    };
    assert.equal((await x.service.sleep("a", 1)).ok, false);
    assert.deepEqual(x.f.events, []);
    x.f.allowed = true;
    x.f.confirm = async () => true;
    x.f.flush = async () => {
      throw Error("fixture");
    };
    assert.equal((await x.service.sleep("a", 1)).ok, false);
    assert.equal(x.store.has("a"), false);
    assert.ok(x.f.key);
  } finally {
    await x.cleanup();
  }
});
test("sleep cannot run without a live page and wake requires current workspace", async () => {
  const x = await fixture();
  try {
    x.f.key = undefined;
    assert.equal((await x.service.sleep("a", 1)).ok, false);
    await x.store.set("a", true);
    x.f.epoch = 2;
    assert.equal((await x.service.wake("a", 1)).ok, false);
    assert.equal(x.store.has("a"), true);
    assert.deepEqual(x.f.events, []);
    await x.service.close();
    assert.equal((await x.service.wake("a", 2)).ok, false);
  } finally {
    await x.cleanup();
  }
});

test("canceled sleep never publishes a durable marker even if a second write would fail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gom-sleep-cancel-")),
    path = join(dir, "sleep.json");
  try {
    await writeFile(path, JSON.stringify({ version: 1, sleeping: [] }));
    let valid = true,
      writes = 0;
    const store = new SleepStore(path, async (temporaryPath, value) => {
      if (++writes > 1) throw Error("a compensating write is unavailable");
      await writeFile(temporaryPath, JSON.stringify(value));
      valid = false;
    });
    await store.load(new Set(["a"]));
    await store.set("a", true, () => valid).catch(() => false);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")).sleeping, []);
    assert.equal(store.has("a"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
