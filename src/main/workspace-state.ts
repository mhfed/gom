import type {
  Account,
  AppState,
  Presentation,
  ProviderTabs,
} from "../shared.ts";
import { normalizePresentation } from "./presentation.ts";
import { normalizeProviderTabs } from "./provider-tabs.ts";

export interface WorkspaceNavigation {
  active: string;
  providerTabs: ProviderTabs;
  presentation: Presentation;
  lastAccounts: Record<string, string>;
  panel: AppState["panel"];
  collapsed: boolean;
}

// Normalize each workspace independently. In particular, an empty private
// workspace must not inherit the built-in tabs from the normal workspace.
export function normalizeWorkspaceNavigation(
  raw: unknown,
  accounts: Account[],
  isPrivate: boolean,
): WorkspaceNavigation {
  const value = (
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  ) as Partial<WorkspaceNavigation>;
  const scoped = accounts.filter(
    (account) => Boolean(account.private) === isPrivate,
  );
  const available = scoped.filter((account) => !account.archived);
  const byId = new Map(available.map((account) => [account.id, account]));
  const providers = [...new Set(available.map((account) => account.provider))];
  const tabs =
    value.providerTabs && typeof value.providerTabs === "object"
      ? value.providerTabs
      : ({} as Partial<ProviderTabs>);
  const providerTabs = normalizeProviderTabs(
    {
      open: Array.isArray(tabs.open) ? tabs.open : providers,
      pinned: tabs.pinned,
    },
    providers,
  );
  const lastAccounts: Record<string, string> = Object.fromEntries(
    Object.entries(
      value.lastAccounts && typeof value.lastAccounts === "object"
        ? value.lastAccounts
        : {},
    ).filter(
      ([provider, id]) =>
        typeof id === "string" && byId.get(id)?.provider === provider,
    ),
  );
  const selected =
    typeof value.active === "string" ? byId.get(value.active) : undefined;
  const active =
    selected && providerTabs.open.includes(selected.provider)
      ? selected.id
      : providerTabs.open
          .map(
            (provider) =>
              lastAccounts[provider] ||
              available.find((account) => account.provider === provider)?.id,
          )
          .find(Boolean) || "";
  const panel = ["service", "settings", "providers", "welcome"].includes(
    value.panel ?? "",
  )
    ? value.panel!
    : "welcome";
  return {
    active,
    providerTabs,
    presentation: normalizePresentation(
      value.presentation,
      scoped.map((account) => account.id),
    ),
    lastAccounts,
    panel: panel === "service" && !active ? "welcome" : panel,
    collapsed: value.collapsed === true,
  };
}
