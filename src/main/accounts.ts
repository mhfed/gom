import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Account, ProviderId } from "../shared.ts";
import { validProviderId } from "./security.ts";
import { SettingsWriter } from "./preferences.ts";
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
  return (["zalo", "messenger", "telegram"] as ProviderId[]).map(
    (provider) => ({
      id: provider,
      provider,
      name: "Cá nhân",
      avatar: "CN",
      archived: false,
    }),
  );
}
export function accountPartition(account: Account) {
  if (validProviderId(account.id)) {
    if (account.id !== account.provider) throw Error("invalid-legacy-account");
    return "persist:" + account.id;
  }
  if (!newId.test(account.id) || !validProviderId(account.provider))
    throw Error("invalid-account-id");
  return "persist:tn-account-" + account.id;
}
export function validateCatalog(raw: unknown): Account[] {
  const data = raw as { version?: unknown; accounts?: unknown };
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.accounts) ||
    data.accounts.length > 100
  )
    throw Error("invalid-catalog");
  const ids = new Set<string>();
  const accounts = data.accounts.map((raw: unknown): Account => {
    const a = raw as Account;
    if (
      !a ||
      typeof a.id !== "string" ||
      !validProviderId(a.provider) ||
      typeof a.name !== "string" ||
      !clean(a.name, 40) ||
      typeof a.avatar !== "string" ||
      typeof a.archived !== "boolean" ||
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
    };
  });
  if (
    !["zalo", "messenger", "telegram"].every((id) => ids.has(id)) ||
    !accounts.some((a) => !a.archived)
  )
    throw Error("invalid-catalog");
  return accounts;
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
    (b) => b.provider === a.provider && !b.archived,
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
  private writable = false;
  constructor(path: string) {
    this.path = path;
    this.writer = new SettingsWriter(path);
    this.backup = new SettingsWriter(path + ".backup");
  }
  async load(): Promise<{
    accounts: Account[];
    writable: boolean;
    warning: string;
  }> {
    try {
      this.snapshot = validateCatalog(
        JSON.parse(await readFile(this.path, "utf8")),
      );
      this.writable = true;
      return { accounts: this.snapshot, writable: true, warning: "" };
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      try {
        this.snapshot = validateCatalog(
          JSON.parse(await readFile(this.path + ".backup", "utf8")),
        );
      } catch (backupError) {
        if (
          missing &&
          (backupError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          try {
            await this.writer.write({ version: 1, accounts: this.snapshot });
            this.writable = true;
            return { accounts: this.snapshot, writable: true, warning: "" };
          } catch {}
        }
      }
      return {
        accounts: this.snapshot,
        writable: false,
        warning:
          "Chưa đọc/ghi được danh sách tài khoản. App mở các phiên nhận diện được ở chế độ bảo vệ; dữ liệu đăng nhập không bị xóa. Tạm khóa thêm/sửa/gỡ để tránh ghi đè danh sách.",
      };
    }
  }
  async commit(accounts: Account[]) {
    if (!this.writable) throw Error("catalog-readonly");
    const next = validateCatalog({ version: 1, accounts });
    await this.backup.write({ version: 1, accounts: this.snapshot });
    await this.writer.write({ version: 1, accounts: next });
    this.snapshot = next;
  }
}
