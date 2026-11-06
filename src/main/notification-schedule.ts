import type { NotificationSchedule } from "../notification-schedule.ts";
import { notificationScheduleAllows } from "../notification-schedule.ts";

type Later = (run: () => void, delay: number) => () => void;
const later: Later = (run, delay) => {
  const timer = setTimeout(run, delay);
  timer.unref();
  return () => clearTimeout(timer);
};

/** Re-evaluates schedule membership against local wall time while Gom runs. */
export class NotificationWorkSchedule {
  private cancel?: () => void;
  private generation = 0;
  private disposed = false;
  private previous?: boolean;
  private previousLocalContext?: string;
  private readonly schedule: () => NotificationSchedule;
  private readonly changed: (allowed: boolean) => void;
  private readonly later: Later;
  private readonly now: () => number;

  constructor(
    schedule: () => NotificationSchedule,
    changed: (allowed: boolean) => void,
    timer: Later = later,
    now = Date.now,
  ) {
    this.schedule = schedule;
    this.changed = changed;
    this.later = timer;
    this.now = now;
  }

  refresh() {
    if (this.disposed) return;
    const now = this.now();
    const date = new Date(now);
    const localContext = [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getTimezoneOffset(),
    ].join(":");
    const allowed = notificationScheduleAllows(this.schedule(), now);
    if (
      this.previous !== allowed ||
      this.previousLocalContext !== localContext
    ) {
      this.previous = allowed;
      this.previousLocalContext = localContext;
      this.changed(allowed);
    }
    this.scheduleNextCheck();
  }

  dispose() {
    this.disposed = true;
    ++this.generation;
    this.cancel?.();
    this.cancel = undefined;
  }

  private scheduleNextCheck() {
    const generation = ++this.generation;
    this.cancel?.();
    this.cancel = undefined;
    if (this.disposed) return;
    // Check at least twice a minute so clock/timezone changes are picked up;
    // align one check with a local minute boundary for schedule transitions.
    const now = this.now();
    const nextMinute = 60_000 - (now % 60_000) + 20;
    this.cancel = this.later(
      () => {
        if (generation !== this.generation || this.disposed) return;
        this.cancel = undefined;
        this.refresh();
      },
      Math.max(1, Math.min(30_000, nextMinute)),
    );
  }
}
