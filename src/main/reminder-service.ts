import type {
  Account,
  AccountResult,
  ReminderSnapshot,
  ReplyReminder,
} from "../shared.ts";
import type { ReminderStore } from "./reminders.ts";

interface ReminderOptions {
  store: ReminderStore;
  accounts(): Account[];
  accessible(id: string): boolean;
  canNotify(id: string): boolean;
  currentEpoch(): number;
  openAccount(id: string): Promise<AccountResult>;
  notify(item: ReplyReminder, click: () => void): { close(): void } | null;
  changed(): void;
}

// The store knows persistence; this service owns account authorization and
// delivery. Neither a renderer's remembered ID nor a native alert grants access.
export class ReminderService {
  private readonly options: ReminderOptions;
  private epoch = 0;
  private alertEpoch = 0;
  private closed = false;
  private ticking: Promise<void> | null = null;
  private readonly alerts = new Map<string, { close(): void }>();

  constructor(options: ReminderOptions) {
    this.options = options;
  }

  snapshot(): ReminderSnapshot {
    const snapshot = this.options.store.snapshot();
    const ids = new Set(
      this.options
        .accounts()
        .filter((a) => this.options.accessible(a.id))
        .map((a) => a.id),
    );
    const items = snapshot.items.filter((item) => ids.has(item.accountId));
    return {
      ...snapshot,
      items,
      dueCount: items.filter(
        (item) => item.completedAt === null && item.dueAt <= Date.now(),
      ).length,
    };
  }

  private account(id: string) {
    return this.options.accounts().find((a) => a.id === id);
  }
  private closeAlert(id: string) {
    this.alerts.get(id)?.close();
    this.alerts.delete(id);
  }
  invalidate(): void {
    this.epoch++;
    this.alertEpoch++;
    for (const id of [...this.alerts.keys()]) this.closeAlert(id);
  }

  async handle(action: unknown, raw: unknown): Promise<AccountResult> {
    if (this.closed) return { ok: false, message: "Gom đang thoát." };
    const data =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const requestEpoch = data.lockVersion;
    const current = () =>
      !this.closed &&
      Number.isSafeInteger(requestEpoch) &&
      requestEpoch === this.options.currentEpoch();
    const cancelled = {
      ok: false,
      message: "Không gian đã đổi. Mở lại nhắc việc để thử lại.",
    };
    if (!current()) return cancelled;
    try {
      if (action === "add") {
        if (
          typeof data.accountId !== "string" ||
          !this.options.accessible(data.accountId) ||
          this.account(data.accountId)?.archived
        )
          return {
            ok: false,
            message: "Chọn tài khoản đang dùng trong không gian hiện tại.",
          };
        const accountId = data.accountId;
        await this.options.store.add(
          {
            accountId: data.accountId,
            note: data.note as string,
            dueAt: data.dueAt as number,
          },
          undefined,
          () =>
            current() &&
            this.options.accessible(accountId) &&
            !this.account(accountId)?.archived,
        );
      } else {
        const item =
          typeof data.id === "string"
            ? this.options.store.snapshot().items.find((r) => r.id === data.id)
            : undefined;
        if (!item || !this.options.accessible(item.accountId))
          return {
            ok: false,
            message: "Nhắc việc không thuộc không gian hiện tại.",
          };
        if (action === "open") {
          if (this.account(item.accountId)?.archived)
            return {
              ok: false,
              message: "Khôi phục tài khoản trong Cài đặt trước khi mở.",
            };
          const result = await this.options.openAccount(item.accountId);
          if (result.ok) this.closeAlert(item.id);
          return result;
        }
        if (!["complete", "snooze", "remove"].includes(action as string))
          return { ok: false, message: "Thao tác nhắc việc chưa hợp lệ." };
        this.epoch++;
        const valid = () =>
          current() && this.options.accessible(item.accountId);
        if (action === "complete")
          await this.options.store.complete(item.id, undefined, valid);
        else if (action === "snooze")
          await this.options.store.snooze(
            item.id,
            data.dueAt as number,
            undefined,
            valid,
          );
        else if (action === "remove")
          await this.options.store.remove(item.id, valid);
        this.closeAlert(item.id);
      }
      if (!current()) return cancelled;
      this.options.changed();
      return { ok: true };
    } catch (error) {
      this.options.changed();
      const state = this.options.store.snapshot();
      return {
        ok: false,
        message: !current()
          ? cancelled.message
          : state.unavailable
            ? state.error
            : error instanceof Error && error.message === "reminders-limit"
              ? "Kho nhắc việc đã đầy (tối đa 500 việc hoặc 1 MiB). Xóa bớt việc cũ để thêm việc mới."
              : "Nhập ghi chú từ 1 đến 500 ký tự và chọn giờ trong tương lai, tối đa một năm.",
      };
    }
  }

  tick(now = Date.now()): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.ticking) return this.ticking;
    this.ticking = this.deliver(now).finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }
  private async deliver(now: number): Promise<void> {
    const snapshot = this.options.store.snapshot();
    const items = snapshot.items;
    for (const [id] of this.alerts) {
      const item = items.find((r) => r.id === id);
      if (
        !item ||
        item.completedAt !== null ||
        !this.options.canNotify(item.accountId)
      )
        this.closeAlert(id);
    }
    if (snapshot.unavailable) return;
    for (const item of items) {
      if (
        this.closed ||
        item.completedAt !== null ||
        item.notifiedAt !== null ||
        item.dueAt > now ||
        !this.options.canNotify(item.accountId)
      )
        continue;
      const epoch = this.epoch;
      const alertEpoch = this.alertEpoch;
      const workspaceEpoch = this.options.currentEpoch();
      const valid = () =>
        !this.closed &&
        epoch === this.epoch &&
        workspaceEpoch === this.options.currentEpoch() &&
        this.options.canNotify(item.accountId);
      try {
        const claimed = await this.options.store.claim(item.id, now, valid);
        if (!claimed) continue;
        if (!valid()) {
          await this.options.store.releaseClaim(item.id, claimed.notifiedAt!);
          continue;
        }
        let alert: { close(): void } | null;
        try {
          alert = this.options.notify(claimed, () => {
            const latest = this.options.store
              .snapshot()
              .items.find((r) => r.id === claimed.id);
            if (
              !this.closed &&
              alertEpoch === this.alertEpoch &&
              latest?.completedAt === null &&
              latest.notifiedAt === claimed.notifiedAt &&
              this.options.accessible(claimed.accountId) &&
              !this.account(claimed.accountId)?.archived
            )
              void this.handle("open", {
                id: claimed.id,
                lockVersion: this.options.currentEpoch(),
              });
          });
        } catch {
          await this.options.store.releaseClaim(item.id, claimed.notifiedAt!);
          continue;
        }
        if (alert && valid()) this.alerts.set(item.id, alert);
        else if (alert) {
          alert.close();
          await this.options.store.releaseClaim(item.id, claimed.notifiedAt!);
        } else
          await this.options.store.releaseClaim(item.id, claimed.notifiedAt!);
      } catch {
        // A failed write locks the store; notes remain available read-only.
      }
    }
    if (!this.closed) this.options.changed();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.invalidate();
    await this.ticking;
    await this.options.store.flush();
  }
}
