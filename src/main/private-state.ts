import type { AppState } from "../shared.ts";

// Renderer snapshots are a capability boundary: hidden records never cross
// IPC, even when the renderer requests state directly rather than subscribing.
export function privateState(state: AppState, unlocked: boolean): AppState {
  if (unlocked) return state;
  const accounts = state.accounts.filter((account) => !account.private);
  const ids = new Set(accounts.map((account) => account.id));
  const active = ids.has(state.active)
    ? state.active
    : (accounts.find((account) => !account.archived)?.id ?? "");
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
    providers,
    active,
    privateSpace: state.privateSpace
      ? { ...state.privateSpace, unlocked: false }
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
      pinned: state.providerTabs.pinned.filter((id) => visibleTabs.has(id)),
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
    // These strings can describe a just-locked account; do not retain them.
    notice: hasPrivate ? "" : state.notice,
    notificationStatus: hasPrivate
      ? "Thông báo do từng nền tảng gửi; tài khoản kín không gửi thông báo."
      : state.notificationStatus,
  };
}
