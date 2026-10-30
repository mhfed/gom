import type { FocusSession } from "../shared.ts";

export const MAX_FOCUS_DURATION = 24 * 60 * 60 * 1000;
export function normalizeFocus(
  raw: unknown,
  now = Date.now(),
): FocusSession | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.endsAt !== "number" ||
    !Number.isSafeInteger(value.endsAt) ||
    value.endsAt <= now ||
    value.endsAt - now > MAX_FOCUS_DURATION ||
    typeof value.muteAudio !== "boolean"
  )
    return;
  return { endsAt: value.endsAt, muteAudio: value.muteAudio };
}

type Later = (run: () => void, delay: number) => () => void;
const later: Later = (run, delay) => {
  const timer = setTimeout(run, delay);
  timer.unref();
  return () => clearTimeout(timer);
};

/** Wall-clock deadline owned by main, independent of renderer visibility. */
export class FocusSchedule {
  private value?: FocusSession;
  private cancel?: () => void;
  private generation = 0;
  private disposed = false;
  private readonly changed: (session: FocusSession | undefined) => void;
  private readonly later: Later;
  private readonly now: () => number;
  constructor(
    changed: (session: FocusSession | undefined) => void,
    timer: Later = later,
    now = Date.now,
  ) {
    this.changed = changed;
    this.later = timer;
    this.now = now;
  }
  snapshot(): FocusSession | undefined {
    return this.value ? { ...this.value } : undefined;
  }
  restore(raw: unknown) {
    if (!this.disposed) this.replace(normalizeFocus(raw, this.now()));
  }
  start(raw: unknown): boolean {
    if (this.disposed) return false;
    const value = normalizeFocus(raw, this.now());
    if (!value) return false;
    this.replace(value);
    return true;
  }
  stop() {
    if (!this.disposed && this.value) this.replace(undefined);
  }
  refresh() {
    if (!this.disposed && this.value && this.value.endsAt <= this.now())
      this.stop();
  }
  dispose() {
    this.disposed = true;
    ++this.generation;
    this.cancel?.();
    this.cancel = undefined;
  }
  private replace(value: FocusSession | undefined) {
    this.value = value;
    this.schedule();
    this.changed(this.snapshot());
  }
  private schedule() {
    const generation = ++this.generation;
    this.cancel?.();
    this.cancel = undefined;
    if (!this.value || this.disposed) return;
    // Periodically recheck wall time for clock changes while the app is idle.
    this.cancel = this.later(
      () => {
        if (generation !== this.generation || this.disposed) return;
        this.cancel = undefined;
        this.refresh();
        if (generation === this.generation) this.schedule();
      },
      Math.max(0, Math.min(30_000, this.value.endsAt - this.now())),
    );
  }
}
