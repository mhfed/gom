import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReminderStore } from "../src/main/reminders.ts";
import { ReminderService } from "../src/main/reminder-service.ts";
import type { Account } from "../src/shared.ts";

async function fixture() {
  let encryptGate: Promise<void> | null = null;
  let encryptEntered: (() => void) | null = null;
  const dir = await mkdtemp(join(tmpdir(), "gom-reminder-service-"));
  const store = new ReminderStore(join(dir, "reminders.json"), {
    encrypt: (text) => {
      if (encryptGate) {
        encryptEntered?.();
        return encryptGate.then(() => Buffer.from(text).toString("base64"));
      }
      return Buffer.from(text).toString("base64");
    },
    decrypt: (text) => Buffer.from(text, "base64").toString(),
  });
  await store.load();
  const accounts: Account[] = [
    {
      id: "public",
      provider: "zalo",
      name: "Public",
      avatar: "P",
      archived: false,
    },
    {
      id: "secret",
      provider: "telegram",
      name: "Secret",
      avatar: "S",
      archived: false,
      private: true,
    },
  ];
  let privateSpace = false,
    paused = false,
    epoch = 0;
  const sent: string[] = [],
    opened: string[] = [],
    clicks: (() => void)[] = [];
  let closes = 0;
  let notifyFailure: "throw" | "null" | null = null;
  const service = new ReminderService({
    store,
    currentEpoch: () => epoch,
    accounts: () => accounts,
    accessible: (id) =>
      accounts.some((a) => a.id === id && !!a.private === privateSpace),
    canNotify: (id) =>
      !paused &&
      accounts.some((a) => a.id === id && !a.archived && !a.private) &&
      !privateSpace,
    openAccount: async (id) => {
      opened.push(id);
      return { ok: true };
    },
    notify: (item, click) => {
      if (notifyFailure === "throw")
        throw new Error("native alerts unavailable");
      if (notifyFailure === "null") return null;
      sent.push(item.note);
      clicks.push(click);
      return { close: () => closes++ };
    },
    changed: () => {},
  });
  return {
    store,
    service,
    get epoch() {
      return epoch;
    },
    advanceEpoch() {
      epoch++;
    },
    handle(action: unknown, data: Record<string, unknown>) {
      return service.handle(action, { ...data, lockVersion: epoch });
    },
    blockEncryption() {
      let release!: () => void, entered!: () => void;
      encryptGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const blocked = new Promise<void>((resolve) => {
        entered = resolve;
      });
      encryptEntered = entered;
      return {
        blocked,
        release() {
          encryptGate = null;
          encryptEntered = null;
          release();
        },
      };
    },
    accounts,
    sent,
    opened,
    clicks,
    deliveryFailure(value: "throw" | "null" | null) {
      notifyFailure = value;
    },
    get closes() {
      return closes;
    },
    space(value: boolean) {
      privateSpace = value;
      epoch++;
      service.invalidate();
    },
    pause(value: boolean) {
      paused = value;
    },
    async clean() {
      await service.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("due normal reminders notify once while private reminders remain scoped and silent", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "Send quote", dueAt: 2000 },
      1000,
    );
    await f.store.add(
      { accountId: "secret", note: "PRIVATE_NOTE", dueAt: 2000 },
      1000,
    );
    await f.service.tick(3000);
    await f.service.tick(4000);
    assert.deepEqual(f.sent, ["Send quote"]);
    assert.equal(
      JSON.stringify(f.service.snapshot()).includes("PRIVATE_NOTE"),
      false,
    );
    f.space(true);
    await f.service.tick(5000);
    assert.deepEqual(
      f.service.snapshot().items.map((r) => r.note),
      ["PRIVATE_NOTE"],
    );
    assert.deepEqual(f.sent, ["Send quote"]);
    assert.equal(
      (
        await f.handle("remove", {
          id: f.store.snapshot().items.find((r) => r.accountId === "public")!
            .id,
        })
      ).ok,
      false,
    );
  } finally {
    await f.clean();
  }
});

test("pause defers delivery and notification click rechecks account membership", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "Call later", dueAt: 2000 },
      1000,
    );
    f.pause(true);
    await f.service.tick(3000);
    assert.deepEqual(f.sent, []);
    f.pause(false);
    await f.service.tick(4000);
    assert.equal(f.sent.length, 1);
    f.accounts[0].private = true;
    f.service.invalidate();
    f.clicks[0]();
    await Promise.resolve();
    assert.deepEqual(f.opened, []);
    assert.equal(f.closes, 1);
  } finally {
    await f.clean();
  }
});

test("archived reminder accounts remain manageable but cannot open or notify", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Archived", dueAt: 2000 },
      1000,
    );
    f.accounts[0].archived = true;
    await f.service.tick(3000);
    assert.equal(f.service.snapshot().items.length, 1);
    assert.deepEqual(f.sent, []);
    assert.equal((await f.handle("open", { id: item.id })).ok, false);
    assert.equal((await f.handle("complete", { id: item.id })).ok, true);
    assert.ok(f.store.snapshot().items[0].completedAt);
  } finally {
    await f.clean();
  }
});

test("a privacy change during a durable claim defers the banner until normal space returns", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Deferred", dueAt: 2000 },
      1000,
    );
    const claim = f.store.claim.bind(f.store);
    f.store.claim = async (...args) => {
      const value = await claim(...args);
      f.space(true);
      return value;
    };
    await f.service.tick(3000);
    assert.deepEqual(f.sent, []);
    assert.equal(
      f.store.snapshot().items.find((r) => r.id === item.id)!.notifiedAt,
      null,
    );
    f.store.claim = claim;
    f.space(false);
    await f.service.tick(4000);
    assert.deepEqual(f.sent, ["Deferred"]);
  } finally {
    await f.clean();
  }
});

test("completing while a claim is in flight prevents its old banner", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Already done", dueAt: 2000 },
      1000,
    );
    const claim = f.store.claim.bind(f.store);
    f.store.claim = async (...args) => {
      const value = await claim(...args);
      assert.equal((await f.handle("complete", { id: item.id })).ok, true);
      return value;
    };
    await f.service.tick(3000);
    assert.deepEqual(f.sent, []);
    assert.ok(
      f.store.snapshot().items.find((r) => r.id === item.id)!.completedAt,
    );
  } finally {
    await f.clean();
  }
});

test("all actions reject missing or stale workspace epochs including a switch back", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Keep", dueAt: 2000 },
      1000,
    );
    const captured = f.epoch;
    f.space(true);
    f.space(false);
    for (const lockVersion of [undefined, captured]) {
      for (const action of ["add", "open", "complete", "snooze", "remove"]) {
        assert.equal(
          (
            await f.service.handle(action, {
              id: item.id,
              accountId: "public",
              note: "Stale",
              dueAt: Date.now() + 60_000,
              lockVersion,
            })
          ).ok,
          false,
          action,
        );
      }
    }
    assert.deepEqual(f.store.snapshot().items, [item]);
    assert.deepEqual(f.opened, []);
    assert.equal((await f.handle("open", { id: item.id })).ok, true);
    assert.deepEqual(f.opened, ["public"]);
  } finally {
    await f.clean();
  }
});

test("a workspace switch cancels add publication and queued completion even after switching back", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Keep", dueAt: 2000 },
      1000,
    );
    const gate = f.blockEncryption();
    const adding = f.handle("add", {
      accountId: "public",
      note: "Cancelled",
      dueAt: Date.now() + 60_000,
    });
    await gate.blocked;
    const completing = f.handle("complete", { id: item.id });
    f.space(true);
    f.space(false);
    gate.release();
    assert.equal((await adding).ok, false);
    assert.equal((await completing).ok, false);
    assert.deepEqual(f.store.snapshot().items, [item]);
    assert.equal(f.store.snapshot().unavailable, false);
    assert.equal((await f.handle("complete", { id: item.id })).ok, true);
  } finally {
    await f.clean();
  }
});

test("close cancels pending claims and queued actions and drains persistence", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Keep", dueAt: 2000 },
      1000,
    );
    const gate = f.blockEncryption();
    const ticking = f.service.tick(3000);
    await gate.blocked;
    const completing = f.handle("complete", { id: item.id });
    let closed = false;
    const closing = f.service.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    assert.equal(closed, false);
    gate.release();
    await Promise.all([ticking, closing]);
    assert.equal((await completing).ok, false);
    assert.equal(closed, true);
    assert.deepEqual(f.sent, []);
    assert.deepEqual(f.store.snapshot().items, [item]);
    assert.equal(f.store.snapshot().unavailable, false);
  } finally {
    await f.clean();
  }
});

test("a failed native notification releases its claim so the next tick can retry", async () => {
  const f = await fixture();
  try {
    const item = await f.store.add(
      { accountId: "public", note: "Retry", dueAt: 2000 },
      1000,
    );
    for (const failure of ["null", "throw"] as const) {
      f.deliveryFailure(failure);
      await f.service.tick(3000);
      assert.deepEqual(f.sent, []);
      assert.equal(f.store.snapshot().items[0].notifiedAt, null);
    }
    f.deliveryFailure(null);
    await f.service.tick(4000);
    assert.deepEqual(f.sent, ["Retry"]);
    f.clicks[0]();
    await Promise.resolve();
    assert.deepEqual(f.opened, [item.accountId]);
  } finally {
    await f.clean();
  }
});

test("editing another reminder keeps an existing notification click usable", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "First", dueAt: 2000 },
      1000,
    );
    const second = await f.store.add(
      { accountId: "public", note: "Second", dueAt: 2000 },
      1000,
    );
    await f.service.tick(3000);
    await f.handle("complete", { id: second.id });
    f.clicks[0]();
    await Promise.resolve();
    assert.deepEqual(f.opened, ["public"]);
    f.clicks[1]();
    await Promise.resolve();
    assert.deepEqual(f.opened, ["public"]);
  } finally {
    await f.clean();
  }
});

test("pausing during encryption cancels claim publication and resumes once", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "Paused", dueAt: 2000 },
      1000,
    );
    const gate = f.blockEncryption();
    const ticking = f.service.tick(3000);
    await gate.blocked;
    f.pause(true);
    gate.release();
    await ticking;
    assert.deepEqual(f.sent, []);
    assert.equal(f.store.snapshot().items[0].notifiedAt, null);
    assert.equal(f.store.snapshot().unavailable, false);
    f.pause(false);
    await f.service.tick(4000);
    await f.service.tick(5000);
    assert.deepEqual(f.sent, ["Paused"]);
  } finally {
    await f.clean();
  }
});

test("a native alert can reopen a currently authorized account after normal hide advances the IPC epoch", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "Reopen Gom", dueAt: 2000 },
      1000,
    );
    await f.service.tick(3000);
    f.advanceEpoch(); // normal hide resets renderer capabilities without revoking normal alerts
    f.clicks[0]();
    await Promise.resolve();
    assert.deepEqual(f.opened, ["public"]);
  } finally {
    await f.clean();
  }
});

test("explicit notification invalidation blocks an old callback even when the IPC epoch is unchanged", async () => {
  const f = await fixture();
  try {
    await f.store.add(
      { accountId: "public", note: "Revoked", dueAt: 2000 },
      1000,
    );
    await f.service.tick(3000);
    f.service.invalidate();
    f.clicks[0]();
    await Promise.resolve();
    assert.deepEqual(f.opened, []);
    assert.equal(f.closes, 1);
  } finally {
    await f.clean();
  }
});
