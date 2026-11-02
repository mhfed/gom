import type {
  ResourceUsage,
  ResourceSnapshot,
  ResourceAccountUsage,
} from "../resource-types.ts";

interface ResourceProcess {
  pid: number;
  creationTime: number;
  memory: { workingSetSize: number };
  cpu: { percentCPUUsage: number };
}
const unknown = (): ResourceUsage => ({ memoryMiB: null, cpuPercent: null });
const validNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
function sum(values: ResourceUsage[], emptyUnknown = false): ResourceUsage {
  if (!values.length)
    return emptyUnknown ? unknown() : { memoryMiB: 0, cpuPercent: 0 };
  const field = (key: keyof ResourceUsage) =>
    values.some((value) => value[key] === null)
      ? null
      : values.reduce((total, value) => total + value[key]!, 0);
  return { memoryMiB: field("memoryMiB"), cpuPercent: field("cpuPercent") };
}

/** Raw PIDs and all-workspace ownership stay inside main. */
export class ResourceProjector {
  private previous = new Set<string>();
  reset() {
    this.previous.clear();
  }
  project(
    metrics: readonly ResourceProcess[],
    owners: ReadonlyMap<number, ReadonlySet<string>>,
    visibleIds: readonly string[],
    sampledAt: number,
  ): ResourceSnapshot {
    const values = new Map<number, ResourceUsage>();
    const seen = new Set<string>();
    for (const metric of metrics) {
      if (
        !Number.isSafeInteger(metric.pid) ||
        metric.pid <= 0 ||
        values.has(metric.pid)
      )
        continue;
      const key = `${metric.pid}:${metric.creationTime}`;
      values.set(metric.pid, {
        memoryMiB: validNumber(metric.memory?.workingSetSize)
          ? metric.memory.workingSetSize / 1024
          : null,
        cpuPercent:
          this.previous.has(key) && validNumber(metric.cpu?.percentCPUUsage)
            ? metric.cpu.percentCPUUsage
            : null,
      });
      if (validNumber(metric.creationTime)) seen.add(key);
    }
    this.previous = seen;
    const visible = new Set(visibleIds);
    const accountValues = new Map<string, ResourceUsage[]>();
    const assigned = new Set<number>();
    const shared = new Set<string>();
    const missing = new Set<string>();
    for (const [pid, ids] of owners) {
      if (ids.size !== 1) {
        for (const id of ids) if (visible.has(id)) shared.add(id);
        continue;
      }
      const id = [...ids][0];
      if (!visible.has(id)) continue;
      const value = values.get(pid);
      if (!value) {
        missing.add(id);
        continue;
      }
      const list = accountValues.get(id) ?? [];
      list.push(value);
      accountValues.set(id, list);
      assigned.add(pid);
    }
    const accounts: Record<string, ResourceAccountUsage> = {};
    for (const id of visibleIds)
      accounts[id] = {
        ...(missing.has(id)
          ? unknown()
          : sum(accountValues.get(id) ?? [], true)),
        shared: shared.has(id),
      };
    return {
      sampledAt,
      total: sum([...values.values()], true),
      accountsTotal: missing.size
        ? unknown()
        : sum(
            [...values]
              .filter(([pid]) => assigned.has(pid))
              .map(([, value]) => value),
            !values.size,
          ),
      other: sum(
        [...values]
          .filter(([pid]) => !assigned.has(pid))
          .map(([, value]) => value),
        !values.size,
      ),
      accounts,
    };
  }
}

type Later = (run: () => void, delay: number) => () => void;
const later: Later = (run, delay) => {
  const timer = setTimeout(run, delay);
  timer.unref();
  return () => clearTimeout(timer);
};
interface SamplerOptions {
  read(): ResourceSnapshot;
  reset(): void;
  changed(snapshot: ResourceSnapshot | null, error: string): void;
}
export class ResourceSampler {
  private enabled = false;
  private disposed = false;
  private generation = 0;
  private cancel?: () => void;
  private options: SamplerOptions;
  private later: Later;
  constructor(options: SamplerOptions, timer: Later = later) {
    this.options = options;
    this.later = timer;
  }
  configure(enabled: boolean) {
    if (this.disposed || enabled === this.enabled) return;
    this.enabled = enabled;
    ++this.generation;
    this.cancel?.();
    this.cancel = undefined;
    this.options.reset();
    if (enabled) {
      this.refresh();
      this.schedule();
    } else this.options.changed(null, "");
  }
  refresh() {
    if (!this.enabled || this.disposed) return;
    try {
      this.options.changed(this.options.read(), "");
    } catch {
      this.options.reset();
      this.options.changed(null, "Chưa đo được tài nguyên. Gom sẽ thử lại.");
    }
  }
  dispose() {
    this.configure(false);
    this.disposed = true;
  }
  private schedule() {
    const generation = this.generation;
    this.cancel = this.later(() => {
      if (!this.enabled || this.disposed || generation !== this.generation)
        return;
      this.cancel = undefined;
      this.refresh();
      this.schedule();
    }, 4000);
  }
}
