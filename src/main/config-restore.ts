import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
  access,
} from "node:fs/promises";
import { renameSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultAccounts, validateCatalog } from "./accounts.ts";
import {
  defaultProviders,
  restoreProviders,
  customProviderMetadata,
} from "./providers.ts";
import { normalizePreferences } from "./preferences.ts";
import { normalizeWorkspaceNavigation } from "./workspace-state.ts";
import {
  MAX_BACKUP_BYTES,
  parseConfigurationBackup,
  mergeConfigurationBackup,
} from "./config-backup.ts";
import type { ConfigurationBackup } from "../backup-types.ts";
const PENDING = "configuration-restore.pending.json";
const JOURNAL = "configuration-restore.journal.json";
const FIXED = new Set([
  "accounts.json",
  "accounts.json.backup",
  "window.json",
  "provider-logos.json",
  PENDING,
]);
const safeName = (name: string) =>
  FIXED.has(name) ||
  /^provider-logos\/(?:zalo|telegram|messenger|gmail|instagram|discord|slack|tinder|web_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-[1-9][0-9]{0,15}\.png$/.test(
    name,
  );
export async function readConfigurationFile(
  path: string,
  limit = MAX_BACKUP_BYTES,
): Promise<Buffer> {
  if ((await stat(path)).size > limit) throw Error("configuration-too-large");
  const data = await readFile(path);
  if (data.length > limit) throw Error("configuration-too-large");
  return data;
}
async function optional(path: string): Promise<Buffer | null> {
  try {
    return await readConfigurationFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
const remove = (path: string) => {
  if (existsSync(path)) unlinkSync(path);
};
/** Only fixed metadata destinations and validated logo names can be published. */
export class ConfigurationTransaction {
  private root: string;
  private publish: (from: string, to: string) => void;
  constructor(root: string, publish = renameSync) {
    this.root = root;
    this.publish = publish;
  }
  async recover(): Promise<boolean> {
    const path = join(this.root, JOURNAL);
    let bytes: Buffer;
    try {
      bytes = await readConfigurationFile(path, 32 * 1024 * 1024);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    const value = JSON.parse(bytes.toString("utf8"));
    if (
      value?.version !== 1 ||
      !value.before ||
      typeof value.before !== "object" ||
      Array.isArray(value.before)
    )
      throw Error("invalid-restore-journal");
    const entries = Object.entries(value.before);
    if (
      entries.length > 208 ||
      entries.some(
        ([name, data]) =>
          !safeName(name) ||
          (data !== null &&
            (typeof data !== "string" ||
              Buffer.from(data, "base64").toString("base64") !== data)),
      )
    )
      throw Error("invalid-restore-journal");
    // Validate the entire journal before writing even its first destination.
    for (const [name, data] of entries) {
      const target = join(this.root, name);
      if (data === null) remove(target);
      else {
        const temporary = target + ".recover-tmp";
        writeFileSync(temporary, Buffer.from(data as string, "base64"), {
          mode: 0o600,
        });
        renameSync(temporary, target);
      }
    }
    remove(path);
    return true;
  }
  async commit(files: Record<string, string | Buffer | null>): Promise<void> {
    await this.recover();
    const entries = Object.entries(files);
    if (entries.length > 208 || entries.some(([name]) => !safeName(name)))
      throw Error("invalid-restore-target");
    const before: Record<string, string | null> = {},
      staged = new Map<string, string>();
    const journal = join(this.root, JOURNAL),
      journalTmp = journal + ".tmp";
    let published = false;
    try {
      for (const [name, value] of entries) {
        const target = join(this.root, name),
          old = await optional(target);
        before[name] = old?.toString("base64") ?? null;
        if (value !== null) {
          await mkdir(dirname(target), { recursive: true });
          const temporary = target + "." + randomUUID() + ".restore-tmp";
          staged.set(name, temporary);
          await writeFile(temporary, value, { mode: 0o600 });
        }
      }
      const record = JSON.stringify({ version: 1, before });
      if (Buffer.byteLength(record) > 32 * 1024 * 1024)
        throw Error("restore-journal-too-large");
      await writeFile(journalTmp, record, { mode: 0o600 });
      renameSync(journalTmp, journal);
      published = true;
      for (const [name, value] of entries) {
        const target = join(this.root, name);
        if (value === null) remove(target);
        else this.publish(staged.get(name)!, target);
      }
      remove(journal);
    } catch (error) {
      if (published) await this.recover();
      throw error;
    } finally {
      remove(journalTmp);
      for (const temporary of staged.values()) remove(temporary);
    }
  }
}
export class ConfigurationRestore {
  private root: string;
  private prepare: (path: string, data: string) => Promise<void>;
  constructor(
    root: string,
    prepare = (path: string, data: string) =>
      writeFile(path, data, { mode: 0o600 }),
  ) {
    this.root = root;
    this.prepare = prepare;
  }
  async queue(
    document: ConfigurationBackup,
    protection: ConfigurationBackup,
    valid: () => boolean,
    committed?: () => void,
  ): Promise<string | null> {
    const next = JSON.stringify(
        parseConfigurationBackup(JSON.stringify(document)),
      ),
      before = JSON.stringify(
        parseConfigurationBackup(JSON.stringify(protection)),
      );
    if (!valid()) return null;
    const directory = join(this.root, "configuration-backups"),
      fileName = `before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.gom-config.json`;
    const temporary = join(this.root, PENDING + ".tmp");
    let published = false;
    try {
      await mkdir(directory, { recursive: true });
      if (!valid()) return null;
      await this.prepare(join(directory, fileName), before);
      if (!valid()) return null;
      await this.prepare(temporary, next);
      if (!valid()) return null;
      renameSync(temporary, join(this.root, PENDING));
      published = true;
      committed?.();
      return fileName;
    } finally {
      if (!published) await rm(temporary, { force: true }).catch(() => {});
    }
  }
  async startup(): Promise<string> {
    const transaction = new ConfigurationTransaction(this.root),
      recovered = await transaction.recover();
    const pending = await optional(join(this.root, PENDING));
    if (!pending)
      return recovered
        ? "Đã phục hồi cấu hình trước thao tác bị gián đoạn."
        : "";
    try {
      const document = parseConfigurationBackup(pending.toString("utf8"));
      // A privacy transition must finish through its existing guarded startup path.
      if (
        await access(join(this.root, "private-membership.json")).then(
          () => true,
          () => false,
        )
      )
        throw Error("privacy-transition-pending");
      const catalogBytes = await optional(join(this.root, "accounts.json"));
      if (
        !catalogBytes &&
        (await access(join(this.root, "private-space.json")).then(
          () => true,
          () => false,
        ))
      )
        throw Error("protected-missing-catalog");
      const catalog = catalogBytes
        ? JSON.parse(catalogBytes.toString("utf8"))
        : null;
      const accounts = catalog ? validateCatalog(catalog) : defaultAccounts(),
        providers =
          catalog?.version === 2
            ? restoreProviders(catalog.providers)
            : defaultProviders();
      const rawWindow = await optional(join(this.root, "window.json")),
        stored = rawWindow ? JSON.parse(rawWindow.toString("utf8")) : {};
      if (!stored || typeof stored !== "object" || Array.isArray(stored))
        throw Error("invalid-settings");
      const merged = mergeConfigurationBackup(
        {
          accounts,
          providers,
          navigation: normalizeWorkspaceNavigation(
            stored.workspaces?.normal ?? stored,
            accounts,
            false,
          ),
          preferences: normalizePreferences(
            stored.preferences,
            accounts.map((a) => a.id),
          ),
          logos: {},
        },
        document,
      );
      const logoBytes = await optional(join(this.root, "provider-logos.json")),
        metadata = logoBytes
          ? JSON.parse(logoBytes.toString("utf8"))
          : { version: 1, logos: {} };
      if (
        metadata?.version !== 1 ||
        !metadata.logos ||
        typeof metadata.logos !== "object" ||
        Array.isArray(metadata.logos)
      )
        throw Error("invalid-logo-metadata");
      const logos = { ...metadata.logos },
        files: Record<string, string | Buffer | null> = {};
      let index = 0;
      for (const [id, logo] of Object.entries(document.logos)) {
        if (logo.kind === "builtin") logos[id] = logo;
        else {
          const revision = Math.max(
            Date.now() * 100 + index++,
            Number.isSafeInteger(logos[id]?.revision)
              ? logos[id].revision + 1
              : 0,
          );
          if (!Number.isSafeInteger(revision))
            throw Error("invalid-logo-revision");
          logos[id] = { kind: "image", revision };
          files[`provider-logos/${id}-${revision}.png`] = Buffer.from(
            logo.dataUrl.slice("data:image/png;base64,".length),
            "base64",
          );
        }
      }
      const navigation = merged.navigation;
      const nextWindow = {
        ...stored,
        active:
          merged.accounts.find((a) => a.id === navigation.active)?.provider ||
          "zalo",
        activeAccount: navigation.active,
        lastAccounts: navigation.lastAccounts,
        collapsed: navigation.collapsed,
        presentation: navigation.presentation,
        providerTabs: navigation.providerTabs,
        preferences: merged.preferences,
        workspaces: { ...stored.workspaces, normal: navigation },
      };
      const nextCatalog = {
        version: 2,
        providers: customProviderMetadata(merged.providers),
        accounts: merged.accounts,
      };
      files["accounts.json.backup"] =
        catalogBytes ??
        JSON.stringify({
          version: 2,
          providers: [],
          accounts: defaultAccounts(),
        });
      files["accounts.json"] = JSON.stringify(nextCatalog);
      files["window.json"] = JSON.stringify(nextWindow);
      files["provider-logos.json"] = JSON.stringify({ version: 1, logos });
      files[PENDING] = null;
      await transaction.commit(files);
      return "Đã khôi phục cấu hình Không gian thường. Phiên đăng nhập trên máy được giữ nguyên.";
    } catch {
      // If rollback itself fails, propagate and stop startup before catalog reads.
      await transaction.recover();
      await rename(
        join(this.root, PENDING),
        join(this.root, `configuration-restore.failed-${randomUUID()}.json`),
      );
      return "Chưa khôi phục được cấu hình. Cấu hình cũ được giữ; kiểm tra tệp sao lưu hoặc quyền ghi rồi thử lại.";
    }
  }
}
