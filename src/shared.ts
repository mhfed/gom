import type { UpdateState } from "./update-types.ts";
import type { ShelfRequest, ShelfResult, ShelfSummary } from "./shelf-types.ts";
export type BuiltinProviderId =
  | "zalo"
  | "messenger"
  | "telegram"
  | "gmail"
  | "instagram"
  | "discord"
  | "slack"
  | "tinder";
export type ProviderId = BuiltinProviderId | `web_${string}`;
export const PROVIDER_ORDER = [
  "zalo",
  "telegram",
  "messenger",
  "gmail",
  "instagram",
  "discord",
  "slack",
  "tinder",
] as const;
export type ProviderLogoSelection =
  | { kind: "builtin"; providerId: BuiltinProviderId }
  | { kind: "image"; revision: number };
export type ProviderLogoChange =
  | { kind: "builtin"; providerId: BuiltinProviderId }
  | { kind: "image"; dataUrl: string }
  | null;
export interface ProviderLogoResult {
  ok: boolean;
  logo?: ProviderLogoSelection | null;
  message?: string;
}
export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  entry: string;
  hosts: readonly string[];
  color: string;
  custom: boolean;
  logo?: ProviderLogoSelection;
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
  private?: boolean;
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
  gmail: {
    id: "gmail",
    label: "Gmail",
    entry: "https://mail.google.com/mail/u/0/",
    hosts: ["mail.google.com", "accounts.google.com"],
    color: "#ea4335",
    custom: false,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    entry: "https://www.instagram.com/direct/inbox/",
    hosts: [
      "www.instagram.com",
      "instagram.com",
      "accountscenter.instagram.com",
      "www.facebook.com",
      "facebook.com",
    ],
    color: "#d62976",
    custom: false,
  },
  discord: {
    id: "discord",
    label: "Discord",
    entry: "https://discord.com/app",
    hosts: [
      "discord.com",
      "discordapp.com",
      "discord.gg",
      "accounts.google.com",
    ],
    color: "#5865f2",
    custom: false,
  },
  slack: {
    id: "slack",
    label: "Slack",
    entry: "https://slack.com/signin",
    hosts: ["slack.com", "app.slack.com", "accounts.google.com"],
    color: "#611f69",
    custom: false,
  },
  tinder: {
    id: "tinder",
    label: "Tinder",
    entry: "https://tinder.com/app/login",
    hosts: ["tinder.com", "www.tinder.com", "accounts.google.com"],
    color: "#ff6b6b",
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
export interface ReplyReminder {
  id: string;
  accountId: AccountId;
  note: string;
  dueAt: number;
  createdAt: number;
  completedAt: number | null;
  notifiedAt: number | null;
}
export interface ReminderSnapshot {
  items: ReplyReminder[];
  dueCount?: number;
  unavailable: boolean;
  error: string;
}
export interface AppState {
  shelf?: ShelfSummary;
  reminders?: ReminderSnapshot;
  floating?: {
    accountId: string | null;
    detached: boolean;
    collapsed: boolean;
    pinned: boolean;
    provider: string;
    account: string;
  };
  privateSpace?: {
    configured: boolean;
    unlocked: boolean;
    unavailable: boolean;
    lockVersion?: number;
    retryAt: number;
  };
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
  panel: "service" | "settings" | "providers" | "welcome";
  statuses: Record<AccountId, ProviderStatus>;
  profiles: ProfileSource[];
  importing: boolean;
  notice: string;
  version: string;
  updates: UpdateState;
}
export interface DesktopBridge {
  shelf(request: ShelfRequest): Promise<ShelfResult>;
  reminder(
    action: "add" | "complete" | "snooze" | "remove" | "open" | "surface",
    data?: {
      id?: string;
      accountId?: AccountId;
      note?: string;
      dueAt?: number;
      open?: boolean;
      lockVersion?: number;
    },
  ): Promise<AccountResult>;
  floatChat(): Promise<AccountResult>;
  privateSpace(
    action: "setup" | "unlock" | "lock" | "change-password" | "membership",
    data?: {
      password?: string;
      newPassword?: string;
      accountId?: AccountId;
      private?: boolean;
    },
  ): Promise<AccountResult>;
  state(): Promise<AppState>;
  activate(id: AccountId): Promise<void>;
  activateProvider(provider: ProviderId, focusPage?: boolean): Promise<void>;
  providerLibrary(open: boolean): Promise<void>;
  welcome(): Promise<void>;
  providerMenu(request: {
    x: number;
    y: number;
    provider?: ProviderId;
    overflow?: ProviderId[];
  }): Promise<void>;
  getProviderLogo(
    provider: ProviderId,
    revision: number,
  ): Promise<string | null>;
  setProviderLogo(
    provider: ProviderId,
    change: ProviderLogoChange,
  ): Promise<ProviderLogoResult>;
  onProviderLogoEditor(callback: (provider: ProviderId) => void): () => void;
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
  importSession(
    sourceId: string,
    accountId?: AccountId,
  ): Promise<{ status: string }>;
  changed(callback: (state: AppState) => void): () => void;
}
