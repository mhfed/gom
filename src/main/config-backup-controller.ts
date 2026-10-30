import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { renameSync } from "node:fs";
import { basename, join, relative, isAbsolute } from "node:path";
import type { BackupResult, ConfigurationBackup } from "../backup-types.ts";
import {
  createConfigurationBackup,
  parseConfigurationBackup,
  mergeConfigurationBackup,
  type ConfigurationSource,
} from "./config-backup.ts";
import {
  ConfigurationRestore,
  readConfigurationFile,
} from "./config-restore.ts";
import { restoreProviders } from "./providers.ts";
interface Options {
  root: string;
  epoch(): number;
  available(): boolean;
  revision(): string;
  source(): Promise<ConfigurationSource>;
  pickExport(): Promise<string | undefined>;
  pickImport(): Promise<string | undefined>;
  confirm(): Promise<boolean>;
  restart(): void;
  openFolder(path: string): Promise<string>;
}
export class ConfigurationBackupController {
  private options: Options;
  private restore: ConfigurationRestore;
  private preview?: {
    token: string;
    document: ConfigurationBackup;
    revision: string;
  };
  constructor(options: Options) {
    this.options = options;
    this.restore = new ConfigurationRestore(options.root);
  }
  reset() {
    this.preview = undefined;
  }
  async run(action: unknown, data: unknown): Promise<BackupResult> {
    const d = data as { lockVersion?: unknown; token?: unknown } | null,
      options = this.options,
      epoch = options.epoch();
    const valid = () =>
      !!d &&
      d.lockVersion === epoch &&
      epoch === options.epoch() &&
      options.available();
    const stale = () => {
      if (!valid()) throw Error("stale-backup");
    };
    if (!valid())
      return {
        ok: false,
        message:
          "Mở Sao lưu trong Không gian thường và thử lại khi thao tác hiện tại hoàn tất.",
      };
    try {
      if (action === "cancel") {
        if (!d?.token || this.preview?.token === d.token) this.reset();
        return { ok: true };
      }
      if (action === "folder") {
        const directory = join(options.root, "configuration-backups");
        await mkdir(directory, { recursive: true });
        stale();
        const error = await options.openFolder(directory);
        return {
          ok: !error,
          message: error ? "Chưa mở được thư mục sao lưu." : undefined,
        };
      }
      if (action === "export") {
        const revision = options.revision(),
          source = await options.source();
        stale();
        if (revision !== options.revision()) throw Error("changed-backup");
        const document = createConfigurationBackup(source),
          path = await options.pickExport();
        stale();
        if (!path) return { ok: true, message: "Đã hủy xuất cấu hình." };
        const inside = relative(options.root, path);
        if (
          !inside ||
          (!inside.startsWith(
            ".." + (process.platform === "win32" ? "\\" : "/"),
          ) &&
            !isAbsolute(inside))
        )
          throw Error("internal-backup-path");
        const temporary = path + "." + randomUUID() + ".tmp";
        let published = false;
        try {
          await writeFile(temporary, JSON.stringify(document, null, 2), {
            mode: 0o600,
            flag: "wx",
          });
          stale();
          renameSync(temporary, path);
          published = true;
          return {
            ok: true,
            message: "Đã xuất cấu hình Không gian thường.",
            fileName: basename(path),
          };
        } finally {
          if (!published) await rm(temporary, { force: true }).catch(() => {});
        }
      }
      if (action === "preview") {
        this.reset();
        const path = await options.pickImport();
        stale();
        if (!path) return { ok: true, message: "Đã hủy chọn tệp." };
        const document = parseConfigurationBackup(
          (await readConfigurationFile(path)).toString("utf8"),
        );
        stale();
        const revision = options.revision(),
          source = await options.source();
        stale();
        if (revision !== options.revision()) throw Error("changed-backup");
        mergeConfigurationBackup(source, document);
        const token = randomUUID(),
          known = new Set(source.accounts.map((a) => a.id));
        this.preview = { token, document, revision };
        const providers = restoreProviders(document.providers);
        return {
          ok: true,
          preview: {
            token,
            fileName: basename(path),
            createdAt: document.createdAt,
            added: document.accounts.filter((a) => !known.has(a.id)).length,
            updated: document.accounts.filter((a) => known.has(a.id)).length,
            providers: document.providers.length,
            logos: Object.keys(document.logos).length,
            accounts: document.accounts.map(
              (a) =>
                `${providers.find((p) => p.id === a.provider)?.label || "Website"} · ${a.name}`,
            ),
            sites: document.providers.map((p) => `${p.label} · ${p.entry}`),
          },
        };
      }
      if (action === "restore") {
        const preview = this.preview;
        if (
          !preview ||
          d?.token !== preview.token ||
          preview.revision !== options.revision()
        )
          throw Error("changed-backup");
        if (!(await options.confirm())) {
          stale();
          return { ok: true, message: "Đã hủy khôi phục." };
        }
        stale();
        const unchanged = () =>
          valid() &&
          preview.revision === options.revision() &&
          this.preview === preview;
        if (!unchanged()) throw Error("changed-backup");
        const source = await options.source();
        if (!unchanged()) throw Error("changed-backup");
        mergeConfigurationBackup(source, preview.document);
        const file = await this.restore.queue(
          preview.document,
          createConfigurationBackup(source),
          unchanged,
          () => {
            this.reset();
            options.restart();
          },
        );
        if (!file) throw Error("changed-backup");
        return {
          ok: true,
          message: "Đã lưu bản bảo vệ. Gom đang khởi động lại để khôi phục.",
        };
      }
      return { ok: false, message: "Thao tác sao lưu không hợp lệ." };
    } catch (error) {
      const code = (error as Error).message;
      const message =
        code === "changed-backup" || code === "stale-backup"
          ? "Cấu hình hoặc không gian đã đổi. Chọn tệp để xem trước lại."
          : code === "configuration-conflict"
            ? "Không thể hợp nhất tài khoản hoặc nền tảng trong tệp này. Cấu hình hiện tại được giữ nguyên."
            : code === "internal-backup-path"
              ? "Chọn nơi lưu bên ngoài thư mục dữ liệu của Gom."
              : action === "restore"
                ? "Chưa lưu được bản bảo vệ hoặc yêu cầu khôi phục. Cấu hình hiện tại được giữ nguyên; kiểm tra quyền ghi và thử lại."
                : "Chưa đọc hoặc ghi được tệp cấu hình. Kiểm tra tệp đúng định dạng Gom và không quá 8 MiB rồi thử lại.";
      return { ok: false, message };
    }
  }
}
