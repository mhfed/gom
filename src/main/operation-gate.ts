/** Coordinates imports and shutdown; once closing, no new transaction can start. */
export class OperationGate {
  private active: Promise<unknown> | undefined;
  private closing = false;
  run<T>(operation: () => Promise<T>): Promise<T> | undefined {
    if (this.closing || this.active) return undefined;
    const pending = operation();
    this.active = pending;
    void pending.then(
      () => {
        if (this.active === pending) this.active = undefined;
      },
      () => {
        if (this.active === pending) this.active = undefined;
      },
    );
    return pending;
  }
  async close(): Promise<void> {
    this.closing = true;
    await this.active?.catch(() => {});
  }
}
