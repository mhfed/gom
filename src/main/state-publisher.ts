/** Publishes the latest JSON-safe application state. */
export class StatePublisher<T> {
  private signature: string | undefined;
  private pending: ReturnType<typeof setTimeout> | undefined;
  private readonly read: () => T;
  private readonly send: (state: T) => void;
  constructor(read: () => T, send: (state: T) => void) {
    this.read = read;
    this.send = send;
  }
  publish(force = false) {
    this.cancel();
    const state = this.read();
    const signature = JSON.stringify(state);
    if (!force && signature === this.signature) return;
    this.send(state);
    // Keep one serialized snapshot, never a mutable reference or history.
    this.signature = signature;
  }
  schedule() {
    // A slow provider must not hold up updates from other accounts.
    this.pending ??= setTimeout(() => this.publish(), 25);
    this.pending.unref();
  }
  cancel() {
    clearTimeout(this.pending);
    this.pending = undefined;
  }
}
