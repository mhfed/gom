import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isBuiltinProviderId, customProviderIdPattern } from "./providers.ts";
import type {
  ProviderId,
  ProviderLogoChange,
  ProviderLogoResult,
  ProviderLogoSelection,
} from "../shared.ts";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_BYTES = 32 * 1024;
const PNG_DATA_URL = "data:image/png;base64,";
type LogoMap = Record<string, ProviderLogoSelection>;

function safeProviderId(value: unknown): value is ProviderId {
  return (
    isBuiltinProviderId(value) ||
    (typeof value === "string" && customProviderIdPattern.test(value))
  );
}

function validPng64(png: Buffer): boolean {
  if (
    png.length < 45 ||
    png.length > MAX_PNG_BYTES ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  )
    return false;
  let offset = 8;
  let first = true;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const end = dataStart + length;
    if (end + 4 > png.length) return false;
    const type = png.toString("ascii", typeStart, typeStart + 4);
    if (first) {
      if (
        type !== "IHDR" ||
        length !== 13 ||
        png.readUInt32BE(dataStart) !== 64 ||
        png.readUInt32BE(dataStart + 4) !== 64
      )
        return false;
      first = false;
    }
    offset = end + 4;
    if (type === "IEND") return length === 0 && offset === png.length;
  }
  return false;
}

function selection(value: unknown): ProviderLogoSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.kind === "builtin" && isBuiltinProviderId(raw.providerId))
    return { kind: "builtin", providerId: raw.providerId };
  if (
    raw.kind === "image" &&
    typeof raw.revision === "number" &&
    Number.isSafeInteger(raw.revision) &&
    raw.revision > 0
  )
    return { kind: "image", revision: raw.revision };
  return undefined;
}

export class ProviderLogoStore {
  private readonly imageDirectory: string;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly metadataPath: string) {
    this.imageDirectory = join(dirname(metadataPath), "provider-logos");
  }

  private imagePath(provider: ProviderId, revision: number) {
    return join(this.imageDirectory, `${provider}-${revision}.png`);
  }

  private async readMetadata(): Promise<LogoMap> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.metadataPath, "utf8"),
      );
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        (parsed as Record<string, unknown>).version !== 1 ||
        !("logos" in parsed) ||
        !parsed.logos ||
        typeof parsed.logos !== "object" ||
        Array.isArray(parsed.logos)
      )
        return {};
      const logos: LogoMap = {};
      for (const [provider, raw] of Object.entries(parsed.logos)) {
        if (!safeProviderId(provider)) continue;
        const value = selection(raw);
        if (value) logos[provider] = value;
      }
      return logos;
    } catch {
      return {};
    }
  }

  async load(knownProviders: ReadonlySet<ProviderId>): Promise<LogoMap> {
    const stored = await this.readMetadata();
    const result: LogoMap = {};
    for (const [provider, logo] of Object.entries(stored)) {
      if (!knownProviders.has(provider as ProviderId)) continue;
      if (logo.kind === "builtin") {
        result[provider] = logo;
        continue;
      }
      try {
        const png = await readFile(
          this.imagePath(provider as ProviderId, logo.revision),
        );
        if (validPng64(png)) result[provider] = logo;
      } catch {
        // A missing or invalid image leaves that provider on its default logo.
      }
    }
    return result;
  }

  async get(provider: ProviderId, revision: number): Promise<string | null> {
    if (
      !safeProviderId(provider) ||
      !Number.isSafeInteger(revision) ||
      revision < 1
    )
      return null;
    try {
      const png = await readFile(this.imagePath(provider, revision));
      return validPng64(png) ? PNG_DATA_URL + png.toString("base64") : null;
    } catch {
      return null;
    }
  }

  set(
    provider: ProviderId,
    change: ProviderLogoChange,
    knownProviders: ReadonlySet<ProviderId>,
  ): Promise<ProviderLogoResult> {
    const task = this.tail
      .catch(() => {})
      .then(() => this.commit(provider, change, knownProviders));
    this.tail = task.then(
      () => {},
      () => {},
    );
    return task;
  }

  private async commit(
    provider: ProviderId,
    change: ProviderLogoChange,
    knownProviders: ReadonlySet<ProviderId>,
  ): Promise<ProviderLogoResult> {
    if (!safeProviderId(provider) || !knownProviders.has(provider))
      return { ok: false, message: "Nền tảng không tồn tại." };
    if (
      change !== null &&
      (!change ||
        typeof change !== "object" ||
        (change.kind !== "builtin" && change.kind !== "image"))
    )
      return { ok: false, message: "Logo không hợp lệ." };
    if (change?.kind === "builtin" && !isBuiltinProviderId(change.providerId))
      return { ok: false, message: "Logo có sẵn không hợp lệ." };

    const logos = await this.readMetadata();
    const previous = logos[provider];
    let next: ProviderLogoSelection | undefined;
    let newlyWrittenPath: string | undefined;
    if (change?.kind === "builtin") {
      next = { kind: "builtin", providerId: change.providerId };
      logos[provider] = next;
    } else if (change?.kind === "image") {
      if (
        typeof change.dataUrl !== "string" ||
        !change.dataUrl.startsWith(PNG_DATA_URL) ||
        change.dataUrl.length >
          PNG_DATA_URL.length + Math.ceil(MAX_PNG_BYTES / 3) * 4
      )
        return { ok: false, message: "Ảnh không hợp lệ hoặc quá lớn." };
      const encoded = change.dataUrl.slice(PNG_DATA_URL.length);
      if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          encoded,
        )
      )
        return { ok: false, message: "Ảnh PNG không hợp lệ." };
      const png = Buffer.from(encoded, "base64");
      if (png.toString("base64") !== encoded || !validPng64(png))
        return { ok: false, message: "Ảnh cần là PNG vuông 64 × 64." };
      const revision = Math.max(
        Date.now() * 100 + randomInt(100),
        previous?.kind === "image" ? previous.revision + 1 : 1,
      );
      next = { kind: "image", revision };
      newlyWrittenPath = this.imagePath(provider, revision);
      const temporaryPath = newlyWrittenPath + `.tmp-${randomUUID()}`;
      try {
        await mkdir(this.imageDirectory, { recursive: true });
        await writeFile(temporaryPath, png, { mode: 0o600, flag: "wx" });
        await rename(temporaryPath, newlyWrittenPath);
      } catch {
        await rm(temporaryPath, { force: true }).catch(() => {});
        return {
          ok: false,
          message: "Chưa lưu được ảnh logo. Bạn thử lại nhé.",
        };
      }
      logos[provider] = next;
    } else {
      delete logos[provider];
    }

    const metadata = JSON.stringify({ version: 1, logos });
    const temporaryMetadataPath = this.metadataPath + `.tmp-${randomUUID()}`;
    try {
      await mkdir(dirname(this.metadataPath), { recursive: true });
      await writeFile(temporaryMetadataPath, metadata, {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporaryMetadataPath, this.metadataPath);
    } catch {
      await rm(temporaryMetadataPath, { force: true }).catch(() => {});
      if (newlyWrittenPath)
        await rm(newlyWrittenPath, { force: true }).catch(() => {});
      return { ok: false, message: "Chưa lưu được logo. Bạn thử lại nhé." };
    }

    if (previous?.kind === "image")
      await rm(this.imagePath(provider, previous.revision), {
        force: true,
      }).catch(() => {});
    return { ok: true, logo: next ?? null };
  }
}
