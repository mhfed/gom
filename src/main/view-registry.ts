import type { ProviderId } from "../shared.ts";
export class ViewRegistry<T, K extends string = ProviderId> {
  private readonly views = new Map<K, T>();
  private readonly create: (id: K) => T;
  constructor(create: (id: K) => T) {
    this.create = create;
  }
  activate(id: K): T {
    let view = this.views.get(id);
    if (!view) {
      view = this.create(id);
      this.views.set(id, view);
    }
    return view;
  }
  peek(id: K): T | undefined {
    return this.views.get(id);
  }
  remove(id: K): T | undefined {
    const view = this.views.get(id);
    this.views.delete(id);
    return view;
  }
  ids(): K[] {
    return [...this.views.keys()];
  }
  entries(): IterableIterator<[K, T]> {
    return this.views.entries();
  }
}
export async function flushBeforeClose(
  sessions: {
    flushStorageData(): void;
    cookies: { flushStore(): Promise<void> };
  }[],
): Promise<boolean> {
  const results = await Promise.allSettled(
    sessions.map(async (session) => {
      let ok = true;
      try {
        session.flushStorageData();
      } catch {
        ok = false;
      }
      try {
        await session.cookies.flushStore();
      } catch {
        ok = false;
      }
      return ok;
    }),
  );
  return results.every(
    (result) => result.status === "fulfilled" && result.value,
  );
}
