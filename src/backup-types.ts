import type { Account, Preferences, ProviderLogoChange } from "./shared.ts";
export type BackupLogo = Exclude<ProviderLogoChange, null>;
export interface ConfigurationBackup {
  format: "gom-config";
  version: 1;
  createdAt: number;
  accounts: Account[];
  providers: { id: string; label: string; entry: string }[];
  navigation: {
    active: string;
    providerTabs: { open: string[]; pinned: string[] };
    presentation: {
      sidebarWidth: number;
      theme: "platform" | "system" | "light" | "dark";
      pinned: string[];
    };
    lastAccounts: Record<string, string>;
    panel: "welcome";
    collapsed: boolean;
  };
  preferences: Omit<Preferences, "focus">;
  logos: Record<string, BackupLogo>;
}
export interface BackupPreview {
  token: string;
  fileName: string;
  createdAt: number;
  added: number;
  updated: number;
  providers: number;
  logos: number;
  accounts: string[];
  sites: string[];
}
export interface BackupResult {
  ok: boolean;
  message?: string;
  preview?: BackupPreview;
  fileName?: string;
}
