/** Keep a provider probe single-flight, retaining one explicit refresh request. */
export class ProbeQueue {
  private readonly running = new WeakMap<object, { refresh: boolean }>();
  async run(key: object, work: () => Promise<void>, refresh = false) {
    const pending = this.running.get(key);
    if (pending) {
      if (refresh) pending.refresh = true;
      return;
    }
    const current = { refresh: false };
    this.running.set(key, current);
    try {
      do {
        current.refresh = false;
        await work();
      } while (current.refresh);
    } finally {
      this.running.delete(key);
    }
  }
}
