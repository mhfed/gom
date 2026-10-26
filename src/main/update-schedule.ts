type Later = (run: () => void, delay: number) => () => void;
const later: Later = (run, delay) => {
  const timer = setTimeout(run, delay);
  timer.unref();
  return () => clearTimeout(timer);
};

/** A single delayed task, paused during sleep and never rescheduled after quit. */
export class UpdateSchedule {
  private check: () => Promise<unknown>;
  private later: Later;
  private cancelTimer?: () => void;
  private generation = 0;
  private enabled = false;
  private sleeping = false;
  private stopped = false;
  private dueAt = 0;
  private now: () => number;
  constructor(
    check: () => Promise<unknown>,
    timer: Later = later,
    now = Date.now,
  ) {
    this.check = check;
    this.later = timer;
    this.now = now;
  }
  configure(enabled: boolean) {
    this.enabled = enabled;
    this.dueAt = this.now() + 30_000;
    this.schedule();
  }
  suspend() {
    this.sleeping = true;
    this.schedule();
  }
  resume() {
    this.sleeping = false;
    this.schedule();
  }
  stop() {
    this.stopped = true;
    this.schedule();
  }
  private schedule() {
    const generation = ++this.generation;
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    if (!this.enabled || this.sleeping || this.stopped) return;
    this.cancelTimer = this.later(
      () => {
        this.cancelTimer = undefined;
        if (generation !== this.generation) return;
        this.dueAt = this.now() + 12 * 60 * 60 * 1000;
        void this.check()
          .catch(() => {})
          .finally(() => {
            if (generation === this.generation) this.schedule();
          });
      },
      Math.max(30_000, this.dueAt - this.now()),
    );
  }
}
