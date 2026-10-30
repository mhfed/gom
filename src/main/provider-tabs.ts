export const PROVIDER_TAB_DEFAULTS_VERSION = 2;
import {
  PROVIDER_ORDER,
  type ProviderId,
  type ProviderTabs,
} from "../shared.ts";

export function normalizeProviderTabs(
  raw: unknown,
  providers: ProviderId[],
): ProviderTabs {
  const value =
    raw && typeof raw === "object" ? (raw as Partial<ProviderTabs>) : {};
  const known = (ids: unknown[]): ProviderId[] => [
    ...new Set(
      ids.filter(
        (id): id is ProviderId =>
          typeof id === "string" && providers.includes(id as ProviderId),
      ),
    ),
  ];
  const open = Array.isArray(value.open)
    ? known(value.open)
    : PROVIDER_ORDER.filter((id) => providers.includes(id));
  const pinned = Array.isArray(value.pinned)
    ? known(value.pinned).filter((id) => open.includes(id))
    : [];
  return { open, pinned };
}

export function openProviderTab(
  tabs: ProviderTabs,
  id: ProviderId,
): ProviderTabs {
  return {
    open: tabs.open.includes(id) ? [...tabs.open] : [...tabs.open, id],
    pinned: [...tabs.pinned],
  };
}

export function toggleProviderPin(
  tabs: ProviderTabs,
  id: ProviderId,
): ProviderTabs {
  const next = openProviderTab(tabs, id);
  next.pinned = next.pinned.includes(id)
    ? next.pinned.filter((p) => p !== id)
    : [...next.pinned, id];
  return next;
}

export function closeProviderTab(
  tabs: ProviderTabs,
  id: ProviderId,
  active: ProviderId,
): {
  tabs: ProviderTabs;
  next: ProviderId | null;
} {
  const index = tabs.open.indexOf(id);
  const open = tabs.open.filter((p) => p !== id);
  return {
    tabs: { open, pinned: tabs.pinned.filter((p) => p !== id) },
    next: open.includes(active)
      ? active
      : (open[Math.max(0, index - 1)] ?? open[0] ?? null),
  };
}
