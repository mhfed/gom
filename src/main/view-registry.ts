import type { ProviderId } from "../shared.ts";
export class ViewRegistry<T> {
  private readonly views = new Map<ProviderId, T>();
  private readonly create: (id: ProviderId) => T;
  constructor(create: (id: ProviderId) => T) {
    this.create = create;
  }
  activate(id: ProviderId): T {
    let view = this.views.get(id);
    if (!view) {
      view = this.create(id);
      this.views.set(id, view);
    }
    return view;
  }
  ids(): ProviderId[] {
    return [...this.views.keys()];
  }
  entries(): IterableIterator<[ProviderId, T]> {
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
