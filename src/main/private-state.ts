import type { AppState } from "../shared.ts";

// Renderer snapshots are a capability boundary: hidden records never cross
// IPC, even when the renderer requests state directly rather than subscribing.
export function privateState(state: AppState, unlocked: boolean): AppState {
  const accounts = state.accounts.filter(
    (account) => Boolean(account.private) === unlocked,
  );
  const ids = new Set(accounts.map((account) => account.id));
  const selectable = accounts.filter(
    (account) =>
      !account.archived && state.providerTabs.open.includes(account.provider),
  );
  const active = selectable.some((account) => account.id === state.active)
    ? state.active
    : (selectable[0]?.id ?? "");
  const changedActive = active !== state.active;
  const hasPrivate = state.accounts.some((account) => account.private);
  const visibleProviders = new Set(accounts.map((account) => account.provider));
  const providers = state.providers.filter(
    (provider) => !provider.custom || visibleProviders.has(provider.id),
  );
  const visibleTabs = new Set(
    accounts
      .filter((account) => !account.archived)
      .map((account) => account.provider),
  );
  const pick = <T>(values: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(values).filter(([id]) => ids.has(id)));
  return {
    ...state,
    accounts,
    reminders: state.reminders
      ? {
          ...state.reminders,
          items: state.reminders.items.filter((item) =>
            ids.has(item.accountId),
          ),
          dueCount: state.reminders.items.filter(
            (item) =>
              ids.has(item.accountId) &&
              item.completedAt === null &&
              item.dueAt <= Date.now(),
          ).length,
        }
      : undefined,
    providers,
    active,
    privateSpace: state.privateSpace
      ? { ...state.privateSpace, unlocked }
      : undefined,
    panel:
      state.panel === "service" && (changedActive || !active)
        ? "welcome"
        : state.panel,
    commandOpen:
      state.panel === "service" && changedActive ? false : state.commandOpen,
    canGoBack:
      changedActive || !active || state.panel !== "service"
        ? false
        : state.canGoBack,
    providerTabs: {
      open: state.providerTabs.open.filter((id) => visibleTabs.has(id)),
      pinned: state.providerTabs.pinned.filter(
        (id) => visibleTabs.has(id) && state.providerTabs.open.includes(id),
      ),
    },
    presentation: {
      ...state.presentation,
      pinned: state.presentation.pinned.filter((id) => ids.has(id)),
    },
    preferences: {
      ...state.preferences,
      notifications: pick(state.preferences.notifications),
    },
    connections: pick(state.connections),
    themes: pick(state.themes),
    unread: pick(state.unread),
    statuses: pick(state.statuses),
    profiles: unlocked ? [] : state.profiles,
    // These strings can describe an account in the workspace just left.
    notice: unlocked || hasPrivate ? "" : state.notice,
    notificationStatus: unlocked
      ? "Tài khoản trong không gian kín không gửi thông báo."
      : hasPrivate
        ? "Thông báo do từng nền tảng gửi; tài khoản kín không gửi thông báo."
        : state.notificationStatus,
  };
}
