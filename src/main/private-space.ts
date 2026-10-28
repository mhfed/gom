import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { AccountResult } from "../shared.ts";
import { SettingsWriter } from "./preferences.ts";

interface Verifier {
  version: 1;
  salt: string;
  hash: string;
  failures: number;
  retryAt: number;
}
const validPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 8 && value.length <= 256;
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(salt, "hex"),
      32,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
const unavailableMessage =
  "Chưa đọc được cấu hình khóa. Các tài khoản kín vẫn được khóa; không thể đặt lại mật khẩu ở đây.";

// This gates Gom's UI. It intentionally does not claim to encrypt Chromium's
// persistent session partitions or protect against the same OS user's tools.
export class PrivateSpaceStore {
  private readonly path: string;
  private readonly writer: SettingsWriter;
  private record: Verifier | null = null;
  private unavailable = true;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
    this.writer = new SettingsWriter(path);
  }

  async load(hasPrivateAccounts: boolean): Promise<void> {
    this.unavailable = true;
    this.record = null;
    try {
      if ((await stat(this.path)).size > 4096) return;
      const data = JSON.parse(await readFile(this.path, "utf8")) as Verifier;
      if (
        !data ||
        data.version !== 1 ||
        typeof data.salt !== "string" ||
        !/^[0-9a-f]{32}$/.test(data.salt) ||
        typeof data.hash !== "string" ||
        !/^[0-9a-f]{64}$/.test(data.hash) ||
        !Number.isSafeInteger(data.failures) ||
        data.failures < 0 ||
        data.failures > 20 ||
        !Number.isSafeInteger(data.retryAt) ||
        data.retryAt < 0
      )
        return;
      this.record = {
        version: 1,
        salt: data.salt,
        hash: data.hash,
        failures: data.failures,
        retryAt: data.retryAt,
      };
      this.unavailable = false;
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        !hasPrivateAccounts
      )
        this.unavailable = false;
    }
  }

  status() {
    return {
      configured: this.record !== null,
      unavailable: this.unavailable,
      retryAt: this.record?.retryAt ?? 0,
    };
  }

  private serialize(
    operation: () => Promise<AccountResult>,
  ): Promise<AccountResult> {
    const task = this.tail.then(operation).catch(() => {
      this.unavailable = true;
      return {
        ok: false,
        message: "Chưa lưu được cấu hình khóa. Không gian kín vẫn được khóa.",
      };
    });
    this.tail = task;
    return task;
  }

  private async save(record: Verifier) {
    await this.writer.write(record);
    this.record = record;
  }

  private async newVerifier(password: string): Promise<Verifier> {
    const salt = randomBytes(16).toString("hex");
    const key = await derive(password, salt);
    try {
      return {
        version: 1,
        salt,
        hash: key.toString("hex"),
        failures: 0,
        retryAt: 0,
      };
    } finally {
      key.fill(0);
    }
  }

  setup(password: unknown): Promise<AccountResult> {
    return this.serialize(async () => {
      if (this.unavailable) return { ok: false, message: unavailableMessage };
      if (this.record)
        return {
          ok: false,
          message: "Đã có mật khẩu. Hãy mở khóa hoặc đổi mật khẩu hiện tại.",
        };
      if (!validPassword(password))
        return { ok: false, message: "Mật khẩu cần từ 8 đến 256 ký tự." };
      await this.save(await this.newVerifier(password));
      return { ok: true };
    });
  }

  private async authenticate(password: unknown): Promise<AccountResult> {
    if (this.unavailable) return { ok: false, message: unavailableMessage };
    if (!this.record)
      return {
        ok: false,
        message: "Bạn chưa đặt mật khẩu cho không gian kín.",
      };
    if (this.record.retryAt > Date.now())
      return {
        ok: false,
        message: `Bạn thử lại sau ${Math.ceil((this.record.retryAt - Date.now()) / 1000)} giây.`,
      };
    let matches = false;
    if (validPassword(password)) {
      const key = await derive(password, this.record.salt);
      try {
        matches = timingSafeEqual(key, Buffer.from(this.record.hash, "hex"));
      } finally {
        key.fill(0);
      }
    }
    if (!matches) {
      const failures = Math.min(this.record.failures + 1, 20);
      const retryAt =
        Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(failures - 1, 9));
      await this.save({ ...this.record, failures, retryAt });
      return {
        ok: false,
        message: "Mật khẩu chưa đúng. Vui lòng đợi một chút rồi thử lại.",
      };
    }
    if (this.record.failures || this.record.retryAt)
      await this.save({ ...this.record, failures: 0, retryAt: 0 });
    return { ok: true };
  }

  verify(password: unknown): Promise<AccountResult> {
    return this.serialize(() => this.authenticate(password));
  }

  changePassword(
    password: unknown,
    newPassword: unknown,
  ): Promise<AccountResult> {
    return this.serialize(async () => {
      if (!validPassword(newPassword))
        return { ok: false, message: "Mật khẩu mới cần từ 8 đến 256 ký tự." };
      const result = await this.authenticate(password);
      if (!result.ok) return result;
      await this.save(await this.newVerifier(newPassword));
      return { ok: true };
    });
  }
}
