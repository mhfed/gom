import type { ProviderId } from "../shared.ts";
export type FailureReason = "network" | "crashed" | "blocked" | "load-failed";
export class RecoveryPolicy<K extends string = ProviderId> {
  private states = new Map<
    K,
    {
      reason: FailureReason | null;
      attempts: number;
      next: number | null;
      healthySince: number | null;
    }
  >();
  private get(id: K) {
    let value = this.states.get(id);
    if (!value) {
      value = { reason: null, attempts: 0, next: null, healthySince: null };
      this.states.set(id, value);
    }
    return value;
  }
  fail(id: K, reason: FailureReason, now: number) {
    const s = this.get(id);
    s.reason = reason;
    s.healthySince = null;
    const delay = [1000, 3000, 10000][s.attempts];
    s.next = reason !== "blocked" && delay !== undefined ? now + delay : null;
  }
  loaded(id: K, now: number) {
    const s = this.get(id);
    s.reason = null;
    s.next = null;
    s.healthySince = now;
  }
  reset(id: K) {
    this.states.delete(id);
  }
  reason(id: K) {
    return this.states.get(id)?.reason ?? null;
  }
  retryAt(id: K) {
    return this.states.get(id)?.next ?? null;
  }
  due(now: number, online: boolean): K[] {
    const due: K[] = [];
    for (const [id, s] of this.states) {
      if (s.healthySince !== null && now - s.healthySince >= 30000)
        s.attempts = 0;
      if (online && s.next !== null && now >= s.next) {
        s.next = null;
        s.attempts++;
        due.push(id);
      }
    }
    return due;
  }
}
