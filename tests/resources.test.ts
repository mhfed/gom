import { test } from "node:test";
import assert from "node:assert/strict";
import { ResourceProjector, ResourceSampler } from "../src/main/resources.ts";

const processMetric = (
  pid: number,
  memory: number,
  cpu = 10,
  creationTime = 1,
) => ({
  pid,
  creationTime,
  memory: { workingSetSize: memory },
  cpu: { percentCPUUsage: cpu },
});
test("resource totals count each PID once, keep shared/hidden costs out of account rows and prime CPU", () => {
  const p = new ResourceProjector();
  const owners = new Map([
    [1, new Set(["a"])],
    [2, new Set(["a", "b"])],
    [3, new Set(["hidden"])],
  ]);
  const metrics = [
    processMetric(1, 10240),
    processMetric(2, 20480),
    processMetric(3, 30720),
    processMetric(4, 40960),
    processMetric(1, 10240),
  ];
  const first = p.project(metrics, owners, ["a", "b"], 1000);
  assert.equal(first.total.memoryMiB, 100);
  assert.equal(first.total.cpuPercent, null);
  assert.deepEqual(first.accounts.a, {
    memoryMiB: 10,
    cpuPercent: null,
    shared: true,
  });
  assert.deepEqual(first.accounts.b, {
    memoryMiB: null,
    cpuPercent: null,
    shared: true,
  });
  assert.equal(first.accounts.hidden, undefined);
  assert.equal(first.other.memoryMiB, 90);
  const next = p.project(metrics, owners, ["a", "b"], 5000);
  assert.equal(next.total.cpuPercent, 40);
  assert.equal(next.accounts.a.cpuPercent, 10);
  assert.equal(next.other.cpuPercent, 30);
  assert.equal(JSON.stringify(next).includes('"pid"'), false);
});
test("missing or malformed metrics stay unknown; reused process IDs start a new CPU interval", () => {
  const p = new ResourceProjector();
  const owners = new Map([
    [1, new Set(["a"])],
    [2, new Set(["b"])],
  ]);
  p.project([processMetric(1, 1024)], owners, ["a", "b"], 1);
  const next = p.project(
    [processMetric(1, 2048, 5, 2), processMetric(3, NaN, -1)],
    owners,
    ["a", "b"],
    2,
  );
  assert.equal(next.accounts.a.cpuPercent, null);
  assert.deepEqual(next.accounts.b, {
    memoryMiB: null,
    cpuPercent: null,
    shared: false,
  });
  assert.equal(next.total.memoryMiB, null);
  assert.equal(next.total.cpuPercent, null);
  const empty = p.project([], owners, ["a"], 3);
  assert.equal(empty.total.memoryMiB, null);
  assert.equal(empty.accountsTotal.memoryMiB, null);
  assert.equal(empty.other.cpuPercent, null);
  p.reset();
  assert.equal(
    p.project([processMetric(1, 1024, 5, 2)], owners, ["a"], 4).accounts.a
      .cpuPercent,
    null,
  );
});
test("resource sampler reads only on the enabled surface, resets intervals and rejects stale callbacks", () => {
  let reads = 0,
    resets = 0;
  const timers: { run(): void; cancelled: boolean; delay: number }[] = [];
  const changes: unknown[] = [];
  const sampler = new ResourceSampler(
    {
      read: () => {
        reads++;
        return new ResourceProjector().project([], new Map(), [], 1);
      },
      reset: () => {
        resets++;
      },
      changed: (snapshot, error) => changes.push([snapshot, error]),
    },
    (run, delay) => {
      const task = { run, delay, cancelled: false };
      timers.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  );
  sampler.refresh();
  assert.equal(reads, 0);
  sampler.configure(true);
  assert.equal(reads, 1);
  assert.equal(timers[0].delay, 4000);
  sampler.configure(true);
  assert.equal(reads, 1);
  timers[0].run();
  assert.equal(reads, 2);
  const stale = timers.at(-1)!;
  sampler.configure(false);
  assert.equal(stale.cancelled, true);
  stale.run();
  assert.equal(reads, 2);
  sampler.configure(true);
  assert.equal(reads, 3);
  assert.equal(resets, 3);
  sampler.dispose();
  timers.at(-1)!.run();
  sampler.refresh();
  assert.equal(reads, 3);
});
test("a failed sample exposes an error and recovers without inventing data", () => {
  let broken = true;
  let result: unknown;
  const sampler = new ResourceSampler(
    {
      read: () => {
        if (broken) throw Error("fixture");
        return new ResourceProjector().project([], new Map(), [], 1);
      },
      reset: () => {},
      changed: (snapshot, error) => {
        result = { snapshot, error };
      },
    },
    () => () => {},
  );
  sampler.configure(true);
  assert.deepEqual(result, {
    snapshot: null,
    error: "Chưa đo được tài nguyên. Gom sẽ thử lại.",
  });
  broken = false;
  sampler.refresh();
  assert.equal((result as { error: string }).error, "");
  sampler.dispose();
});

test("missing account process cannot turn its subtotal into a measured zero", () => {
  const p = new ResourceProjector(),
    owners = new Map([[2, new Set(["a"])]]);
  const result = p.project([processMetric(1, 1024)], owners, ["a"], 1000);
  assert.deepEqual(result.accountsTotal, { memoryMiB: null, cpuPercent: null });
  assert.equal(result.other.memoryMiB, 1);
});
