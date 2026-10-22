import { readFile, access, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pbkdf2Sync } from "node:crypto";
import type { ProfileSource } from "../shared.ts";
import { decodeChromeCookie, chromiumExpiry } from "./import-crypto.ts";
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
export class ChromeSources {
  private readonly root: string;
  private readonly preferredEmail: string;
  constructor(root: string, preferredEmail = "") {
    this.root = root;
    this.preferredEmail = preferredEmail;
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
  ): Promise<{ version: number; cookies: EncryptedCookie[] }> {
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
    const rows: EncryptedCookie[] = await query(
      "SELECT host_key AS host,name,path,is_secure AS secure,is_httponly AS httpOnly,expires_utc AS expiry,hex(encrypted_value) AS encrypted,value AS plain FROM cookies WHERE host_key IN ('.facebook.com','facebook.com') AND name IN ('c_user','xs')",
    );
    const version = Number(meta[0]?.value);
    if (!Number.isInteger(version) || version < 1 || version > 1000)
      throw new ImportFailure("unsupported");
    if (
      rows.some(
        (row) =>
          ![".facebook.com", "facebook.com"].includes(row.host) ||
          !["c_user", "xs"].includes(row.name) ||
          row.path !== "/",
      )
    )
      throw new ImportFailure("unsupported");
    return { version, cookies: rows };
  }
  async loginCookies(id: string): Promise<LoginCookie[]> {
    const source = await this.read(id);
    if (
      source.cookies.length !== 2 ||
      new Set(source.cookies.map((x) => x.name)).size !== 2
    )
      throw new ImportFailure("needs-login");
    if (
      source.cookies.some(
        (row) => row.expiry && chromiumExpiry(row.expiry)! <= Date.now() / 1000,
      )
    )
      throw new ImportFailure("needs-login");
    let key: Buffer | undefined;
    try {
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
      return source.cookies.map((cookie) => ({
        url: "https://www.facebook.com/",
        domain: cookie.host,
        name: cookie.name,
        value: decodeChromeCookie(cookie, key!, source.version),
        path: "/",
        secure: !!cookie.secure,
        httpOnly: !!cookie.httpOnly,
        ...(chromiumExpiry(cookie.expiry) !== undefined
          ? { expirationDate: chromiumExpiry(cookie.expiry) }
          : {}),
      }));
    } catch (error) {
      if (error instanceof ImportFailure) throw error;
      throw new ImportFailure(key ? "unsupported" : "needs-os-authorization");
    } finally {
      key?.fill(0);
      source.cookies = [];
    }
  }
}
