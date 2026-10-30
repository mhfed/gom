import type { Account, Preferences, ProviderDefinition } from "../shared.ts";
import type { BackupLogo, ConfigurationBackup } from "../backup-types.ts";
import { validateCatalog } from "./accounts.ts";
import {
  customProviderMetadata,
  restoreProviders,
  isBuiltinProviderId,
} from "./providers.ts";
import { normalizePreferences } from "./preferences.ts";
import {
  normalizeWorkspaceNavigation,
  type WorkspaceNavigation,
} from "./workspace-state.ts";
import { validPng64 } from "./png-logo.ts";
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
export interface ConfigurationSource {
  accounts: Account[];
  providers: ProviderDefinition[];
  navigation: WorkspaceNavigation;
  preferences: Preferences;
  logos: Record<string, BackupLogo>;
}
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("invalid-backup");
  return value as Record<string, any>;
}
function keys(value: unknown, allowed: string[]) {
  const item = object(value);
  if (Object.keys(item).some((key) => !allowed.includes(key)))
    throw Error("invalid-backup-field");
  return item;
}
export function validateBackupLogo(value: unknown): BackupLogo {
  const item = object(value);
  if (item.kind === "builtin" && isBuiltinProviderId(item.providerId)) {
    keys(item, ["kind", "providerId"]);
    return { kind: "builtin", providerId: item.providerId };
  }
  keys(item, ["kind", "dataUrl"]);
  const prefix = "data:image/png;base64,";
  if (
    item.kind !== "image" ||
    typeof item.dataUrl !== "string" ||
    !item.dataUrl.startsWith(prefix) ||
    item.dataUrl.length > prefix.length + Math.ceil(32768 / 3) * 4
  )
    throw Error("invalid-backup-logo");
  const encoded = item.dataUrl.slice(prefix.length),
    png = Buffer.from(encoded, "base64");
  if (png.toString("base64") !== encoded || !validPng64(png))
    throw Error("invalid-backup-logo");
  return { kind: "image", dataUrl: item.dataUrl };
}
export function createConfigurationBackup(
  source: ConfigurationSource,
  now = Date.now(),
): ConfigurationBackup {
  const accounts = source.accounts
    .filter((a) => !a.private)
    .map(({ id, provider, name, avatar, archived }) => ({
      id,
      provider,
      name,
      avatar,
      archived,
    }));
  const ids = new Set(accounts.map((a) => a.id)),
    providerIds = new Set<string>(accounts.map((a) => a.provider));
  const navigation = normalizeWorkspaceNavigation(
    { ...source.navigation, panel: "welcome" },
    accounts,
    false,
  );
  return parseConfigurationBackup(
    JSON.stringify({
      format: "gom-config",
      version: 1,
      createdAt: now,
      accounts,
      providers: customProviderMetadata(
        source.providers.filter((p) => providerIds.has(p.id)),
      ),
      navigation,
      preferences: {
        paused: source.preferences.paused,
        shortcut: source.preferences.shortcut,
        updateChecks: source.preferences.updateChecks,
        notifications: Object.fromEntries(
          Object.entries(source.preferences.notifications).filter(([id]) =>
            ids.has(id),
          ),
        ),
      },
      logos: Object.fromEntries(
        Object.entries(source.logos).filter(([id]) => providerIds.has(id)),
      ),
    }),
  );
}
export function parseConfigurationBackup(text: string): ConfigurationBackup {
  if (Buffer.byteLength(text) > MAX_BACKUP_BYTES)
    throw Error("backup-too-large");
  const raw = keys(JSON.parse(text), [
    "format",
    "version",
    "createdAt",
    "accounts",
    "providers",
    "navigation",
    "preferences",
    "logos",
  ]);
  if (
    raw.format !== "gom-config" ||
    raw.version !== 1 ||
    !Number.isSafeInteger(raw.createdAt) ||
    raw.createdAt <= 0 ||
    !Number.isFinite(new Date(raw.createdAt).getTime())
  )
    throw Error("invalid-backup-version");
  if (
    !Array.isArray(raw.accounts) ||
    raw.accounts.length > 104 ||
    !Array.isArray(raw.providers)
  )
    throw Error("invalid-backup");
  for (const a of raw.accounts)
    keys(a, ["id", "provider", "name", "avatar", "archived"]);
  for (const p of raw.providers) keys(p, ["id", "label", "entry"]);
  const ids = new Set<string>(raw.accounts.map((a: any) => a.id));
  // Catalog normalization adds new built-ins; a portable subset must not invent
  // ordinary accounts for IDs that may belong to the private workspace.
  const accounts = validateCatalog({
    version: 2,
    accounts: raw.accounts,
    providers: raw.providers,
  }).filter((a) => ids.has(a.id));
  const providers = restoreProviders(raw.providers),
    providerIds = new Set<string>(accounts.map((a) => a.provider));
  if (raw.providers.some((p: any) => !providerIds.has(p.id)))
    throw Error("unreferenced-backup-provider");
  const preference = keys(raw.preferences, [
    "paused",
    "shortcut",
    "updateChecks",
    "notifications",
  ]);
  if (
    ["paused", "shortcut", "updateChecks"].some(
      (k) => typeof preference[k] !== "boolean",
    )
  )
    throw Error("invalid-backup-preferences");
  const notifications = object(preference.notifications);
  if (
    Object.entries(notifications).some(
      ([id, value]) =>
        !ids.has(id) || !["ask", "mute", "allow"].includes(value),
    )
  )
    throw Error("invalid-backup-notifications");
  const preferences = normalizePreferences(preference, [...ids]);
  const nav = keys(raw.navigation, [
    "active",
    "providerTabs",
    "presentation",
    "lastAccounts",
    "panel",
    "collapsed",
  ]);
  const tabs = keys(nav.providerTabs, ["open", "pinned"]),
    presentation = keys(nav.presentation, ["theme", "sidebarWidth", "pinned"]);
  const references = [
    ...(Array.isArray(tabs.open) ? tabs.open : []),
    ...(Array.isArray(tabs.pinned) ? tabs.pinned : []),
  ];
  if (
    !Array.isArray(tabs.open) ||
    !Array.isArray(tabs.pinned) ||
    references.some((p) => !providerIds.has(p))
  )
    throw Error("invalid-backup-tabs");
  if (
    !Array.isArray(presentation.pinned) ||
    presentation.pinned.some((id: unknown) => !ids.has(id as string)) ||
    typeof presentation.sidebarWidth !== "number" ||
    !Number.isFinite(presentation.sidebarWidth) ||
    !["platform", "system", "light", "dark"].includes(presentation.theme) ||
    typeof nav.collapsed !== "boolean" ||
    typeof nav.active !== "string" ||
    (nav.active && !ids.has(nav.active))
  )
    throw Error("invalid-backup-navigation");
  if (
    Object.entries(object(nav.lastAccounts)).some(
      ([provider, id]) =>
        !accounts.some((a) => a.id === id && a.provider === provider),
    )
  )
    throw Error("invalid-backup-last-account");
  const navigation = {
    ...normalizeWorkspaceNavigation(
      { ...nav, panel: "welcome" },
      accounts,
      false,
    ),
    panel: "welcome" as const,
  };
  const logos = Object.fromEntries(
    Object.entries(object(raw.logos)).map(([id, value]) => {
      if (!providerIds.has(id)) throw Error("invalid-backup-logo-provider");
      return [id, validateBackupLogo(value)];
    }),
  );
  return {
    format: "gom-config",
    version: 1,
    createdAt: raw.createdAt,
    accounts,
    providers: customProviderMetadata(providers),
    navigation,
    preferences,
    logos,
  };
}
export function mergeConfigurationBackup(
  current: ConfigurationSource,
  backup: ConfigurationBackup,
): ConfigurationSource {
  const document = parseConfigurationBackup(JSON.stringify(backup)),
    imported = restoreProviders(document.providers);
  const providers = [...current.providers];
  for (const provider of imported) {
    const existing = providers.find((p) => p.id === provider.id);
    if (existing && existing.entry !== provider.entry)
      throw Error("configuration-conflict");
    if (!existing) providers.push(provider);
  }
  const byId = new Map(current.accounts.map((a) => [a.id, a]));
  for (const account of document.accounts) {
    const existing = byId.get(account.id);
    if (
      existing &&
      (existing.private || existing.provider !== account.provider)
    )
      throw Error("configuration-conflict");
  }
  const importedIds = new Set(document.accounts.map((a) => a.id));
  const accounts = [
    ...document.accounts,
    ...current.accounts.filter((a) => !importedIds.has(a.id)),
  ].map((a) => ({ ...a }));
  if (accounts.length > 104 || providers.filter((p) => p.custom).length > 100)
    throw Error("configuration-limit");
  const navigation = normalizeWorkspaceNavigation(
    {
      ...document.navigation,
      providerTabs: {
        open: [
          ...new Set([
            ...document.navigation.providerTabs.open,
            ...current.navigation.providerTabs.open,
          ]),
        ],
        pinned: [
          ...new Set([
            ...document.navigation.providerTabs.pinned,
            ...current.navigation.providerTabs.pinned,
          ]),
        ],
      },
      presentation: {
        ...document.navigation.presentation,
        pinned: [
          ...document.navigation.presentation.pinned,
          ...current.navigation.presentation.pinned.filter(
            (id) => !importedIds.has(id),
          ),
        ],
      },
    },
    accounts,
    false,
  );
  return {
    accounts,
    providers,
    navigation,
    preferences: {
      ...current.preferences,
      ...document.preferences,
      notifications: {
        ...current.preferences.notifications,
        ...document.preferences.notifications,
      },
    },
    logos: { ...current.logos, ...document.logos },
  };
}
