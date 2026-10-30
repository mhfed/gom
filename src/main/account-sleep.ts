import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { renameSync } from "node:fs";
import { dirname } from "node:path";
import type { AccountResult } from "../shared.ts";

/** Separate metadata transaction; never rewrites general preferences. */
export class SleepStore {
  private ids = new Set<string>();
  private known = new Set<string>();
  private ready = false;
  private failed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private path: string;
  private prepare: (temporaryPath: string, value: unknown) => Promise<void>;
  constructor(
    path: string,
    prepare?: (temporaryPath: string, value: unknown) => Promise<void>,
  ) {
    this.path = path;
    this.prepare =
      prepare ??
      ((temporaryPath, value) =>
        writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600 }));
  }
  get unavailable() {
    return this.failed || !this.ready;
  }
  has(id: string) {
    return this.ids.has(id);
  }
  snapshot() {
    return [...this.ids];
  }
  async load(known: ReadonlySet<string>) {
    this.known = new Set(known);
    try {
      const raw = JSON.parse(await readFile(this.path, "utf8"));
      if (
        !raw ||
        raw.version !== 1 ||
        !Array.isArray(raw.sleeping) ||
        raw.sleeping.length > 104 ||
        raw.sleeping.some(
          (id: unknown) => typeof id !== "string" || id.length > 200,
        )
      )
        throw Error("invalid-sleep-state");
      this.ids = new Set(
        (raw.sleeping as string[]).filter((id) => known.has(id)),
      );
      this.ready = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.ids.clear();
        this.ready = true;
      } else this.failed = true;
    }
  }
  register(id: string) {
    this.known.add(id);
  }
  set(
    id: string,
    asleep: boolean,
    valid = () => true,
    commit?: () => void,
  ): Promise<boolean> {
    const operation = this.queue.then(async () => {
      if (this.unavailable || !this.known.has(id))
        throw Error("sleep-store-unavailable");
      if (!valid()) return false;
      if (this.ids.has(id) === asleep) {
        commit?.();
        return true;
      }
      const next = new Set(this.ids),
        temporaryPath = this.path + ".tmp";
      if (asleep) next.add(id);
      else next.delete(id);
      let published = false;
      try {
        await mkdir(dirname(this.path), { recursive: true });
        await this.prepare(temporaryPath, { version: 1, sleeping: [...next] });
        if (!valid()) return false;
        // No asynchronous boundary between final validation, publication and
        // page transition: cancellation never needs a second durable write.
        renameSync(temporaryPath, this.path);
        published = true;
        this.ids = next;
        commit?.();
        return true;
      } catch (error) {
        this.failed = true;
        throw error;
      } finally {
        if (!published)
          await rm(temporaryPath, { force: true }).catch(() => {});
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}

interface SleepOptions {
  store: SleepStore;
  epoch(): number;
  accessible(id: string): boolean;
  view(id: string): unknown;
  blocked(id: string): string;
  confirm(id: string): Promise<boolean>;
  flush(id: string): Promise<void>;
  close(id: string): void;
  activate(id: string): void;
  changed(): void;
}
const cancelled = (): AccountResult => ({
  ok: false,
  message: "Trạng thái đã thay đổi. Thao tác ngủ/thức đã hủy.",
});
export class AccountSleepService {
  private options: SleepOptions;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Set<string>();
  private revisions = new Map<string, number>();
  private stopped = false;
  constructor(options: SleepOptions) {
    this.options = options;
  }
  busy() {
    return [...this.pending];
  }
  cancel(id: string) {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
  }
  sleep(id: string, epoch: number): Promise<AccountResult> {
    const key = this.options.view(id),
      revision = this.revisions.get(id) ?? 0;
    const valid = () =>
      !this.stopped &&
      this.options.epoch() === epoch &&
      this.options.accessible(id) &&
      this.options.view(id) === key &&
      revision === (this.revisions.get(id) ?? 0) &&
      !this.options.blocked(id);
    return this.run(id, async () => {
      if (!key || !valid())
        return {
          ok: false,
          message:
            this.options.blocked(id) ||
            "Tài khoản chưa mở hoặc không còn khả dụng.",
        };
      if (!(await this.options.confirm(id)) || !valid()) return cancelled();
      await this.options.flush(id);
      if (!valid()) return cancelled();
      if (
        !(await this.options.store.set(id, true, valid, () =>
          this.options.close(id),
        ))
      )
        return cancelled();
      return { ok: true, accountId: id };
    });
  }
  wake(id: string, epoch: number): Promise<AccountResult> {
    this.cancel(id);
    const revision = this.revisions.get(id);
    const valid = () =>
      !this.stopped &&
      this.options.epoch() === epoch &&
      this.options.accessible(id) &&
      revision === this.revisions.get(id);
    return this.run(id, async () => {
      if (!valid()) return cancelled();
      if (
        !(await this.options.store.set(id, false, valid, () =>
          this.options.activate(id),
        ))
      )
        return cancelled();
      return { ok: true, accountId: id };
    });
  }
  async close() {
    this.stopped = true;
    await this.queue;
  }
  private run(
    id: string,
    operation: () => Promise<AccountResult>,
  ): Promise<AccountResult> {
    if (this.stopped || this.pending.has(id))
      return Promise.resolve(cancelled());
    this.pending.add(id);
    this.options.changed();
    const task = this.queue.then(operation).catch(() => ({
      ok: false,
      message:
        "Chưa lưu được trạng thái ngủ/thức hoặc dữ liệu phiên. Trang đang mở được giữ nguyên.",
    }));
    this.queue = task.then(() => {});
    return task.finally(() => {
      this.pending.delete(id);
      this.options.changed();
    });
  }
}
