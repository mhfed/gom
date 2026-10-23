export type ProviderId = "zalo" | "messenger" | "telegram";
export type ProviderStatus =
  "idle" | "loading" | "ready" | "needs-login" | "authenticated" | "error";
export const PROVIDERS = {
  zalo: {
    id: "zalo",
    label: "Zalo",
    entry: "https://chat.zalo.me/",
    hosts: ["chat.zalo.me", "id.zalo.me", "jr.zaloapp.com", "jr.chat.zalo.me"],
    color: "#0068ff",
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
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    entry: "https://web.telegram.org/k/",
    hosts: ["web.telegram.org"],
    color: "#279cda",
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
  notifications: Record<ProviderId, NotificationChoice>;
}
export interface ConnectionState {
  phase: "connecting" | "connected" | "offline" | "error";
  reason: "network" | "crashed" | "blocked" | "load-failed" | null;
  retryAt: number | null;
}
export interface AppState {
  preferences: Preferences;
  connections: Record<ProviderId, ConnectionState>;
  canGoBack: boolean;
  openAtLogin: boolean;
  startupAvailable: boolean;
  notificationStatus: string;
  themes: Record<ProviderId, ShellTheme | null>;
  collapsed: boolean;
  unread: Record<ProviderId, UnreadInfo>;
  active: ProviderId;
  panel: "service" | "settings";
  statuses: Record<ProviderId, ProviderStatus>;
  profiles: ProfileSource[];
  importing: boolean;
  notice: string;
  version: string;
}
export interface DesktopBridge {
  state(): Promise<AppState>;
  activate(id: ProviderId): Promise<void>;
  reload(): Promise<void>;
  openBrowser(): Promise<void>;
  settings(): Promise<void>;
  toggleSidebar(): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;
  setPreference(
    key: "paused" | "shortcut" | "openAtLogin",
    value: boolean,
  ): Promise<void>;
  setNotification(id: ProviderId, choice: NotificationChoice): Promise<void>;
  testNotification(id: ProviderId): Promise<void>;
  notificationSettings(): Promise<void>;
  importMessenger(sourceId: string): Promise<{ status: string }>;
  changed(callback: (state: AppState) => void): () => void;
}
