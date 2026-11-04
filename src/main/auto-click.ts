export interface AutoClickOptions {
  x: number;
  y: number;
  interval: number;
  count: number;
}

export class AutoClicker {
  running = false;
  private generation = 0;
  private timer: unknown;
  private readonly env: {
    schedule(fn: () => void, delay: number): unknown;
    cancel(timer: unknown): void;
    valid(): boolean;
    click(x: number, y: number): void;
    changed(running: boolean, completed: number): void;
  };
  constructor(env: AutoClicker["env"]) {
    this.env = env;
  }

  start(options: AutoClickOptions): boolean {
    const { x, y, interval, count } = options;
    if (
      ![x, y, interval, count].every(Number.isSafeInteger) ||
      x < 0 ||
      y < 0 ||
      interval < 100 ||
      interval > 60000 ||
      count < 1 ||
      count > 100000
    )
      return false;
    this.stop();
    this.running = true;
    const generation = ++this.generation;
    let completed = 0;
    const tick = () => {
      if (!this.running || generation !== this.generation) return;
      if (!this.env.valid()) {
        this.stop();
        return;
      }
      try {
        this.env.click(x, y);
      } catch {
        this.stop();
        return;
      }
      completed++;
      if (completed >= count) {
        this.stop(completed);
        return;
      }
      this.timer = this.env.schedule(tick, interval);
    };
    this.env.changed(true, 0);
    this.timer = this.env.schedule(tick, interval);
    return true;
  }

  stop(completed = 0): void {
    const wasRunning = this.running;
    this.running = false;
    this.generation++;
    if (this.timer !== undefined) this.env.cancel(this.timer);
    this.timer = undefined;
    if (wasRunning) this.env.changed(false, completed);
  }
}
