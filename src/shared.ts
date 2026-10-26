import type { UpdateState } from "./update-types.ts";
export type BuiltinProviderId = "zalo" | "messenger" | "telegram";
export type ProviderId = BuiltinProviderId | `web_${string}`;
export const PROVIDER_ORDER = ["zalo", "telegram", "messenger"] as const;
export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  entry: string;
  hosts: readonly string[];
  color: string;
  custom: boolean;
}
export interface ProviderTabs {
  open: ProviderId[];
  pinned: ProviderId[];
}
export type AccountId = string;
export interface Account {
  id: AccountId;
  provider: ProviderId;
  name: string;
  avatar: string;
  archived: boolean;
}
export interface AccountResult {
  ok: boolean;
  accountId?: AccountId;
  message?: string;
}
export interface ProviderResult extends AccountResult {
  providerId?: ProviderId;
}
export type ProviderStatus =
  "idle" | "loading" | "ready" | "needs-login" | "authenticated" | "error";
export const PROVIDERS = {
  zalo: {
    id: "zalo",
    label: "Zalo",
    entry: "https://chat.zalo.me/",
    hosts: ["chat.zalo.me", "id.zalo.me", "jr.zaloapp.com", "jr.chat.zalo.me"],
    color: "#0068ff",
    custom: false,
  },
  messenger: {
    id: "messenger",
    label: "Messenger",
    entry: "https://www.facebook.com/messages/",
    hosts: [
      "www.facebook.com",
      "facebook.com",
      "www.messenger.com",
      "messenger.com",
    ],
    color: "#8458ef",
    custom: false,
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    entry: "https://web.telegram.org/k/",
    hosts: ["web.telegram.org"],
    color: "#279cda",
    custom: false,
  },
} as const;
export interface ProfileSource {
  id: string;
  label: string;
  email: string;
  preferred: boolean;
}
export interface UnreadInfo {
  count: number | null;
  kind: "messages" | "conversations";
  approximate: boolean;
  source: "platform" | "loaded" | "unavailable";
}
export interface ShellTheme {
  mode: "light" | "dark";
  background: string;
  surface: string;
  line: string;
  text: string;
  muted: string;
}
export type NotificationChoice = "ask" | "allow" | "mute";
export interface Preferences {
  paused: boolean;
  shortcut: boolean;
  updateChecks: boolean;
  notifications: Record<AccountId, NotificationChoice>;
}
export interface ConnectionState {
  phase: "connecting" | "connected" | "offline" | "error";
  reason: "network" | "crashed" | "blocked" | "load-failed" | null;
  retryAt: number | null;
}
export interface Presentation {
  sidebarWidth: number;
  theme: "platform" | "system" | "light" | "dark";
  pinned: AccountId[];
}
export interface AppState {
  providers: ProviderDefinition[];
  providerTabs: ProviderTabs;
  presentation: Presentation;
  commandOpen: boolean;
  accounts: Account[];
  accountBusy: boolean;
  catalogWarning: string;
  preferences: Preferences;
  connections: Record<AccountId, ConnectionState>;
  canGoBack: boolean;
  openAtLogin: boolean;
  startupAvailable: boolean;
  notificationStatus: string;
  themes: Record<AccountId, ShellTheme | null>;
  collapsed: boolean;
  unread: Record<AccountId, UnreadInfo>;
  active: AccountId;
  panel: "service" | "settings" | "providers";
  statuses: Record<AccountId, ProviderStatus>;
  profiles: ProfileSource[];
  importing: boolean;
  notice: string;
  version: string;
  updates: UpdateState;
}
export interface DesktopBridge {
  state(): Promise<AppState>;
  activate(id: AccountId): Promise<void>;
  activateProvider(provider: ProviderId, focusPage?: boolean): Promise<void>;
  providerLibrary(open: boolean): Promise<void>;
  providerMenu(request: {
    x: number;
    y: number;
    provider?: ProviderId;
    overflow?: ProviderId[];
  }): Promise<void>;
  pinProvider(id: ProviderId): Promise<void>;
  closeProvider(id: ProviderId): Promise<AccountResult>;
  addProvider(name: string, url: string): Promise<ProviderResult>;
  navigationMenu(): Promise<void>;
  accountMenu(anchor: { x: number; y: number }): Promise<void>;
  accountEditor(open: boolean): Promise<void>;
  addAccount(
    provider: ProviderId,
    name: string,
    avatar: string,
  ): Promise<AccountResult>;
  editAccount(
    id: AccountId,
    name: string,
    avatar: string,
  ): Promise<AccountResult>;
  moveAccount(id: AccountId, direction: -1 | 1): Promise<AccountResult>;
  archiveAccount(id: AccountId): Promise<AccountResult>;
  restoreAccount(id: AccountId): Promise<AccountResult>;
  reload(): Promise<void>;
  openBrowser(): Promise<void>;
  settings(): Promise<void>;
  checkUpdates(): Promise<void>;
  openUpdateDownload(): Promise<void>;
  updatesRequested(callback: () => void): () => void;
  toggleSidebar(): Promise<void>;
  setSidebarWidth(width: number): Promise<void>;
  setTheme(theme: Presentation["theme"]): Promise<void>;
  pinAccount(id: AccountId): Promise<void>;
  command(open: boolean): Promise<void>;
  commandClosed(): Promise<void>;
  commandRequested(callback: () => void): () => void;
  back(): Promise<void>;
  home(): Promise<void>;
  setPreference(
    key: "paused" | "shortcut" | "openAtLogin" | "updateChecks",
    value: boolean,
  ): Promise<void>;
  setNotification(id: AccountId, choice: NotificationChoice): Promise<void>;
  testNotification(id: AccountId): Promise<void>;
  notificationSettings(): Promise<void>;
  importMessenger(
    sourceId: string,
    accountId?: AccountId,
  ): Promise<{ status: string }>;
  changed(callback: (state: AppState) => void): () => void;
}
