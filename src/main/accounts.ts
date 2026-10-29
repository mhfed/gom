import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  PROVIDER_ORDER,
  type Account,
  type ProviderDefinition,
  type ProviderId,
} from "../shared.ts";
import { validProviderId } from "./security.ts";
import { SettingsWriter } from "./preferences.ts";
import {
  customProviderMetadata,
  defaultProviders,
  isBuiltinProviderId,
  restoreProviders,
} from "./providers.ts";
const newId =
  /^acc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const clean = (value: string, max: number) =>
  Array.from(
    value
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim(),
  )
    .slice(0, max)
    .join("");
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}
export function defaultAccounts(): Account[] {
  const legacyOrder: ProviderId[] = ["zalo", "messenger", "telegram"];
  const order = [
    ...legacyOrder,
    ...PROVIDER_ORDER.filter((id) => !legacyOrder.includes(id)),
  ];
  return order.map((provider) => ({
    id: provider,
    provider,
    name: "Cá nhân",
    avatar: "CN",
    archived: false,
  }));
}
export function accountPartition(account: Account) {
  if (isBuiltinProviderId(account.id)) {
    if (account.id !== account.provider) throw Error("invalid-legacy-account");
    return "persist:" + account.id;
  }
  if (!newId.test(account.id) || !validProviderId(account.provider))
    throw Error("invalid-account-id");
  return "persist:tn-account-" + account.id;
}
export function validateCatalog(raw: unknown): Account[] {
  return readCatalog(raw).accounts;
}
function readCatalog(raw: unknown): {
  accounts: Account[];
  providers: ProviderDefinition[];
} {
  const data = raw as {
    version?: unknown;
    accounts?: unknown;
    providers?: unknown;
  };
  if (
    !data ||
    ![1, 2].includes(data.version as number) ||
    !Array.isArray(data.accounts) ||
    data.accounts.length > 104
  )
    throw Error("invalid-catalog");
  const providers =
    data.version === 2 ? restoreProviders(data.providers) : defaultProviders();
  const knownProviders = new Set(providers.map((provider) => provider.id));
  const ids = new Set<string>();
  const accounts = data.accounts.map((raw: unknown): Account => {
    const a = raw as Account;
    if (
      !a ||
      typeof a.id !== "string" ||
      !validProviderId(a.provider) ||
      !knownProviders.has(a.provider) ||
      typeof a.name !== "string" ||
      !clean(a.name, 40) ||
      typeof a.avatar !== "string" ||
      typeof a.archived !== "boolean" ||
      (a.private !== undefined && typeof a.private !== "boolean") ||
      ids.has(a.id)
    )
      throw Error("invalid-catalog");
    accountPartition(a);
    ids.add(a.id);
    return {
      id: a.id,
      provider: a.provider,
      name: clean(a.name, 40),
      avatar: clean(a.avatar, 8) || initials(clean(a.name, 40)),
      archived: a.archived,
      ...(a.private === undefined ? {} : { private: a.private }),
    };
  });
  // Add newly introduced built-ins to existing catalogs without changing the
  // IDs or partitions of accounts that were already saved.
  for (const account of defaultAccounts()) {
    if (!ids.has(account.id)) {
      accounts.push(account);
      ids.add(account.id);
    }
  }
  if (!accounts.some((a) => !a.archived)) throw Error("invalid-catalog");
  return { accounts, providers };
}
export function createAccount(
  provider: ProviderId,
  name: string,
  avatar = "",
  uuid = randomUUID(),
): Account {
  if (
    !validProviderId(provider) ||
    typeof name !== "string" ||
    !clean(name, 40) ||
    typeof avatar !== "string"
  )
    throw Error("invalid-account-name");
  const account = {
    id: "acc_" + uuid,
    provider,
    name: clean(name, 40),
    avatar: clean(avatar, 8) || initials(clean(name, 40)),
    archived: false,
  };
  accountPartition(account);
  return account;
}
export function editAccount(
  accounts: Account[],
  id: string,
  name: string,
  avatar: string,
): Account[] {
  if (
    typeof name !== "string" ||
    !clean(name, 40) ||
    typeof avatar !== "string" ||
    !accounts.some((a) => a.id === id)
  )
    throw Error("invalid-account-name");
  return accounts.map((a) =>
    a.id === id
      ? {
          ...a,
          name: clean(name, 40),
          avatar: clean(avatar, 8) || initials(clean(name, 40)),
        }
      : a,
  );
}
export function archiveAccount(accounts: Account[], id: string): Account[] {
  const a = accounts.find((a) => a.id === id && !a.archived);
  if (!a || accounts.filter((a) => !a.archived).length < 2)
    throw Error("last-account");
  return accounts.map((a) => (a.id === id ? { ...a, archived: true } : a));
}
export function restoreAccount(accounts: Account[], id: string): Account[] {
  if (!accounts.some((a) => a.id === id && a.archived))
    throw Error("unknown-account");
  return accounts.map((a) => (a.id === id ? { ...a, archived: false } : a));
}
export function moveAccount(
  accounts: Account[],
  id: string,
  direction: -1 | 1,
): Account[] {
  const a = accounts.find((a) => a.id === id && !a.archived);
  if (!a || ![-1, 1].includes(direction)) throw Error("unknown-account");
  const peers = accounts.filter(
    (b) =>
      b.provider === a.provider &&
      Boolean(b.private) === Boolean(a.private) &&
      !b.archived,
  );
  const other = peers[peers.indexOf(a) + direction];
  if (!other) return accounts.slice();
  const next = accounts.slice(),
    i = accounts.indexOf(a),
    j = accounts.indexOf(other);
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
export class AccountCatalogStore {
  private path: string;
  private writer: SettingsWriter;
  private backup: SettingsWriter;
  private snapshot: Account[] = defaultAccounts();
  private providers: ProviderDefinition[] = defaultProviders();
  private writable = false;
  constructor(path: string) {
    this.path = path;
    this.writer = new SettingsWriter(path);
    this.backup = new SettingsWriter(path + ".backup");
  }
  async load(protectMissingCatalog = false): Promise<{
    accounts: Account[];
    providers: ProviderDefinition[];
    writable: boolean;
    warning: string;
  }> {
    this.writable = false;
    try {
      const catalog = readCatalog(
        JSON.parse(await readFile(this.path, "utf8")),
      );
      this.snapshot = catalog.accounts;
      this.providers = catalog.providers;
      this.writable = true;
      return {
        accounts: this.snapshot,
        providers: this.providers,
        writable: true,
        warning: "",
      };
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      try {
        const catalog = readCatalog(
          JSON.parse(await readFile(this.path + ".backup", "utf8")),
        );
        this.snapshot = catalog.accounts;
        this.providers = catalog.providers;
      } catch (backupError) {
        if (
          !protectMissingCatalog &&
          missing &&
          (backupError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          try {
            await this.writer.write(
              this.serialized(this.snapshot, this.providers),
            );
            this.writable = true;
            return {
              accounts: this.snapshot,
              providers: this.providers,
              writable: true,
              warning: "",
            };
          } catch {}
        }
      }
      // With evidence of private space use, an older backup cannot prove a
      // session is public. Ordinary installations retain read-only recovery.
      const protectRecovered =
        protectMissingCatalog ||
        this.snapshot.some((account) => account.private);
      return {
        accounts: protectRecovered
          ? this.snapshot.map((account) => ({ ...account, private: true }))
          : this.snapshot,
        providers: this.providers,
        writable: false,
        warning: protectRecovered
          ? "Chưa đọc/ghi được danh sách tài khoản. Các phiên được khóa để tránh lộ tài khoản kín từ bản sao cũ; dữ liệu đăng nhập không bị xóa. Tạm khóa thêm/sửa/gỡ để tránh ghi đè danh sách."
          : "Chưa đọc/ghi được danh sách tài khoản. App mở các phiên nhận diện được ở chế độ bảo vệ; dữ liệu đăng nhập không bị xóa. Tạm khóa thêm/sửa/gỡ để tránh ghi đè danh sách.",
      };
    }
  }
  private serialized(
    accounts: Account[],
    providers: readonly ProviderDefinition[],
  ) {
    return {
      version: 2,
      providers: customProviderMetadata(providers),
      accounts,
    };
  }
  async commit(
    accounts: Account[],
    providers: readonly ProviderDefinition[] = this.providers,
  ) {
    if (!this.writable) throw Error("catalog-readonly");
    const next = readCatalog(this.serialized(accounts, providers));
    await this.backup.write(this.serialized(this.snapshot, this.providers));
    await this.writer.write(this.serialized(next.accounts, next.providers));
    this.snapshot = next.accounts;
    this.providers = next.providers;
  }
}
