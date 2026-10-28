import { readFile, access, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pbkdf2Sync } from "node:crypto";
import type { DatabaseSync as SQLiteDatabaseSync } from "node:sqlite";
import type { BuiltinProviderId, ProfileSource } from "../shared.ts";
import {
  decodeChromeCookie,
  decodeWindowsChromeCookie,
  chromiumExpiry,
} from "./import-crypto.ts";
import { unprotectWindowsDpapi } from "./windows-dpapi.ts";
import type { LoginCookie } from "./cookie-transaction.ts";
const execute = promisify(execFile);
export class ImportFailure extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
interface EncryptedCookie {
  host: string;
  name: string;
  path: string;
  secure: number;
  httpOnly: number;
  expiry: number;
  encrypted: string;
  plain: string;
}
export const COOKIE_SCOPES: Record<BuiltinProviderId, readonly string[]> = {
  zalo: ["zalo.me", "zaloapp.com"],
  messenger: ["facebook.com"],
  telegram: ["telegram.org"],
  gmail: ["google.com"],
  instagram: ["instagram.com"],
  discord: ["discord.com", "discordapp.com"],
  slack: ["slack.com"],
  tinder: [],
};
export const AUTH_COOKIE_NAMES: Record<BuiltinProviderId, readonly string[]> = {
  zalo: ["zpw_sek", "zpw_token"],
  messenger: ["c_user", "xs"],
  telegram: [],
  gmail: [],
  instagram: ["sessionid", "ds_user_id"],
  discord: [],
  slack: ["d"],
  tinder: [],
};
function cookieHostInScope(host: string, scopes: readonly string[]) {
  const normalized = host.replace(/^\./, "").toLowerCase();
  return scopes.some(
    (scope) => normalized === scope || normalized.endsWith("." + scope),
  );
}
export class ChromeSources {
  private readonly root: string;
  private readonly preferredEmail: string;
  private readonly platform: NodeJS.Platform;
  constructor(
    root: string,
    preferredEmail = "",
    platform: NodeJS.Platform = process.platform,
  ) {
    this.root = root;
    this.preferredEmail = preferredEmail;
    this.platform = platform;
  }
  async list(): Promise<ProfileSource[]> {
    try {
      const parsed = JSON.parse(
        await readFile(join(this.root, "Local State"), "utf8"),
      );
      return Object.entries(parsed?.profile?.info_cache ?? {})
        .filter(([id]) => /^(Default|Profile \d+)$/.test(id))
        .map(([id, data]) => {
          const record = data as { name?: unknown; user_name?: unknown };
          const email =
            typeof record.user_name === "string" ? record.user_name : "";
          return {
            id,
            label: typeof record.name === "string" ? record.name : id,
            email,
            preferred:
              !!this.preferredEmail &&
              email.toLowerCase() === this.preferredEmail.toLowerCase(),
          };
        })
        .sort((a, b) => Number(b.preferred) - Number(a.preferred));
    } catch {
      return [];
    }
  }
  async read(
    id: string,
    provider: BuiltinProviderId = "messenger",
  ): Promise<{ version: number; cookies: EncryptedCookie[] }> {
    const names = AUTH_COOKIE_NAMES[provider];
    if (!names.length) throw new ImportFailure("unsupported-session");
    if (!(await this.list()).some((source) => source.id === id))
      throw new ImportFailure("source-unavailable");
    const profile = await realpath(join(this.root, id)).catch(() => {
      throw new ImportFailure("source-unavailable");
    });
    const root = await realpath(this.root);
    if (!profile.startsWith(root + sep))
      throw new ImportFailure("source-unavailable");
    let database: string | undefined;
    for (const location of [
      join(profile, "Network", "Cookies"),
      join(profile, "Cookies"),
    ]) {
      try {
        await access(location);
        database = location;
        break;
      } catch {}
    }
    if (!database) throw new ImportFailure("source-unavailable");
    const query = async (sql: string) => {
      if (this.platform === "win32") {
        let db: SQLiteDatabaseSync | undefined;
        try {
          const { DatabaseSync } = await import("node:sqlite");
          db = new DatabaseSync(database!, { readOnly: true, timeout: 8000 });
          return db.prepare(sql).all() as unknown as Record<string, unknown>[];
        } catch (error) {
          throw new ImportFailure(
            /locked|busy/i.test(String(error))
              ? "source-busy"
              : "source-unavailable",
          );
        } finally {
          db?.close();
        }
      }
      try {
        const { stdout } = await execute(
          "/usr/bin/sqlite3",
          ["-readonly", "-json", database!, sql],
          { encoding: "utf8", timeout: 8000, maxBuffer: 512 * 1024 },
        );
        return JSON.parse(stdout || "[]");
      } catch (error) {
        const stderr = String((error as { stderr?: unknown }).stderr ?? "");
        throw new ImportFailure(
          /locked|busy/i.test(stderr) ? "source-busy" : "source-unavailable",
        );
      }
    };
    const meta = await query("SELECT value FROM meta WHERE key='version'");
    const scopes = COOKIE_SCOPES[provider];
    const hosts = scopes
      .flatMap((host) =>
        provider === "messenger"
          ? [`LOWER(host_key)='${host}'`, `LOWER(host_key)='.${host}'`]
          : [
              `LOWER(host_key)='${host}'`,
              `LOWER(host_key)='.${host}'`,
              `LOWER(host_key) LIKE '%.' || '${host}'`,
            ],
      )
      .join(" OR ");
    const allowedNames = names.map((name) => `'${name}'`).join(",");
    const rows: EncryptedCookie[] = await query(
      `SELECT host_key AS host,name,path,is_secure AS secure,is_httponly AS httpOnly,expires_utc AS expiry,hex(encrypted_value) AS encrypted,value AS plain FROM cookies WHERE (${hosts}) AND LOWER(name) IN (${allowedNames})`,
    );
    const version = Number(meta[0]?.value);
    if (!Number.isInteger(version) || version < 1 || version > 1000)
      throw new ImportFailure("unsupported");
    if (
      rows.some(
        (row) =>
          !cookieHostInScope(row.host, scopes) ||
          !names.includes(row.name) ||
          typeof row.path !== "string" ||
          !row.path.startsWith("/") ||
          (provider === "messenger" &&
            (![".facebook.com", "facebook.com"].includes(row.host) ||
              row.path !== "/")),
      )
    )
      throw new ImportFailure("unsupported");
    return { version, cookies: rows };
  }
  private async windowsEncryptionKey(): Promise<Buffer | undefined> {
    let state: unknown;
    try {
      state = JSON.parse(
        await readFile(join(this.root, "Local State"), "utf8"),
      );
    } catch {
      return undefined;
    }
    const encryptedKey = (
      state as {
        os_crypt?: { encrypted_key?: unknown };
      }
    )?.os_crypt?.encrypted_key;
    if (typeof encryptedKey !== "string" || encryptedKey.length > 8192)
      return undefined;
    const wrapped = Buffer.from(encryptedKey, "base64");
    if (
      !wrapped.length ||
      wrapped.toString("base64") !== encryptedKey ||
      wrapped.subarray(0, 5).toString("ascii") !== "DPAPI"
    ) {
      wrapped.fill(0);
      throw new ImportFailure("needs-os-authorization");
    }
    let key: Buffer;
    try {
      key = await unprotectWindowsDpapi(wrapped.subarray(5));
    } catch {
      wrapped.fill(0);
      throw new ImportFailure("needs-os-authorization");
    }
    wrapped.fill(0);
    if (key.length !== 32) {
      key.fill(0);
      throw new ImportFailure("unsupported");
    }
    return key;
  }
  async loginCookies(
    id: string,
    provider: BuiltinProviderId = "messenger",
  ): Promise<LoginCookie[]> {
    const source = await this.read(id, provider);
    const cookies: LoginCookie[] = [];
    let key: Buffer | undefined;
    let windowsKey: Buffer | undefined;
    let succeeded = false;
    let unsupportedFormat = false;
    let appBoundRequiredCookie = false;
    try {
      if (this.platform === "darwin") {
        const response = await execute(
          "/usr/bin/security",
          ["find-generic-password", "-s", "Chrome Safe Storage", "-w"],
          { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 },
        );
        key = pbkdf2Sync(
          response.stdout.replace(/\r?\n$/, ""),
          "saltysalt",
          1003,
          16,
          "sha1",
        );
        response.stdout = "";
      } else if (this.platform === "win32") {
        windowsKey = await this.windowsEncryptionKey();
      } else {
        throw new ImportFailure("unsupported");
      }
      const required =
        provider === "messenger"
          ? ["c_user", "xs"]
          : AUTH_COOKIE_NAMES[provider];
      for (const cookie of source.cookies) {
        const expirationDate = chromiumExpiry(cookie.expiry);
        if (expirationDate !== undefined && expirationDate <= Date.now() / 1000)
          continue;
        const format = Buffer.from(cookie.encrypted || "", "hex")
          .subarray(0, 3)
          .toString("ascii");
        if (this.platform === "win32" && format === "v20") {
          if (required.includes(cookie.name)) appBoundRequiredCookie = true;
          unsupportedFormat = true;
          continue;
        }
        try {
          const value =
            this.platform === "win32"
              ? await decodeWindowsChromeCookie(
                  cookie,
                  windowsKey,
                  source.version,
                  unprotectWindowsDpapi,
                )
              : decodeChromeCookie(cookie, key!, source.version);
          if (!value) continue;
          cookies.push({
            url:
              provider === "messenger"
                ? "https://www.facebook.com/"
                : `https://${cookie.host.replace(/^\./, "")}/`,
            domain: cookie.host,
            name: cookie.name,
            value,
            path: cookie.path,
            secure: !!cookie.secure,
            httpOnly: !!cookie.httpOnly,
            ...(expirationDate !== undefined ? { expirationDate } : {}),
          });
        } catch {
          // Ignore only this cookie when Chrome uses an unsupported format.
          unsupportedFormat = true;
        }
      }
      if (
        !cookies.length ||
        required.some((name) => !cookies.some((cookie) => cookie.name === name))
      )
        throw new ImportFailure(
          appBoundRequiredCookie
            ? "app-bound"
            : unsupportedFormat
              ? "unsupported"
              : "needs-login",
        );
      succeeded = true;
      return cookies;
    } catch (error) {
      if (error instanceof ImportFailure) throw error;
      throw new ImportFailure(key ? "unsupported" : "needs-os-authorization");
    } finally {
      key?.fill(0);
      windowsKey?.fill(0);
      for (const cookie of source.cookies) cookie.plain = "";
      source.cookies = [];
      if (!succeeded) cookies.forEach((cookie) => (cookie.value = ""));
    }
  }
}
