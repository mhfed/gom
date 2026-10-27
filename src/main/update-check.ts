import type { UpdateState } from "../update-types.ts";

export const RELEASES_URL = "https://github.com/mhfed/gom/releases";
const RELEASES_API = "https://api.github.com/repos/mhfed/gom/releases/latest";
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_NOTES_LENGTH = 12000;
const NO_PUBLIC_RELEASE = Symbol("no-public-release");
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Options = {
  currentVersion: string;
  arch: string;
  onChange: (state: UpdateState) => void;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};
type PendingCheck = {
  controller: AbortController;
  previous: UpdateState;
  promise: Promise<UpdateState>;
};
class CheckFailure extends Error {}
class CancelledCheck extends Error {}

function versionParts(value: string): bigint[] | null {
  if (value.length > 64 || STABLE_VERSION.exec(value)?.[0] !== value)
    return null;
  return value.split(".").map((part) => BigInt(part));
}
function compareVersions(left: bigint[], right: bigint[]): number {
  for (let index = 0; index < 3; index++) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function invalidRelease(): never {
  throw new CheckFailure(
    "Thông tin bản phát hành không hợp lệ. Vui lòng thử lại sau.",
  );
}
function plainNotes(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return invalidRelease();
  // The shell renders this as textContent. Do not interpret Markdown or HTML.
  return value
    .replace(/\r\n?/g, "\n")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .trim()
    .slice(0, MAX_NOTES_LENGTH);
}
function compatibleName(name: string, version: string, arch: string): boolean {
  if (name.length > 180) return false;
  const escapedVersion = version.replaceAll(".", "\\.");
  const architecture = arch === "universal" ? "universal" : `${arch}|universal`;
  const pattern = new RegExp(
    `^(?:Gom|TinNhan|Tin Nhan|tin-nhan-desktop)[-_ ](?:(?:macOS|darwin)[-_ ])?(?:(?:${architecture})[-_ ]v?${escapedVersion}|v?${escapedVersion}[-_ ](?:${architecture}))\\.(?:dmg|zip)$`,
    "i",
  );
  return pattern.exec(name)?.[0] === name;
}
function inspectRelease(value: unknown, current: bigint[], arch: string) {
  if (
    !object(value) ||
    value.draft !== false ||
    value.prerelease !== false ||
    typeof value.tag_name !== "string" ||
    !Array.isArray(value.assets)
  )
    return invalidRelease();
  const tag = value.tag_name;
  const version = tag.startsWith("v") ? tag.slice(1) : tag;
  const parts = versionParts(version);
  if (!parts) return invalidRelease();
  // Only this exact repository and tag may ever be opened. Supplied URLs are
  // checked against the constructed URL, never passed through to the renderer.
  const url = `${RELEASES_URL}/tag/${tag}`;
  if (value.html_url !== url) return invalidRelease();
  const notes = plainNotes(value.body);
  let compatible = false;
  for (const asset of value.assets) {
    if (!object(asset) || typeof asset.name !== "string")
      return invalidRelease();
    if (!compatibleName(asset.name, version, arch)) continue;
    const expected = `${RELEASES_URL}/download/${tag}/${encodeURIComponent(asset.name)}`;
    if (asset.browser_download_url !== expected) return invalidRelease();
    compatible = true;
  }
  return {
    version,
    url,
    notes,
    compatible,
    comparison: compareVersions(parts, current),
  };
}

async function boundedJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const cancelBody = () => {
    void response.body?.cancel().catch(() => {});
  };
  const length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) {
    cancelBody();
    throw new CheckFailure(
      "Thông tin bản phát hành quá lớn. Vui lòng thử lại sau.",
    );
  }
  if (!response.body) return invalidRelease();
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        abort();
        throw new CheckFailure(
          "Thông tin bản phát hành quá lớn. Vui lòng thử lại sau.",
        );
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return invalidRelease();
  }
}

/** Discovers a public release only. It never downloads or installs an asset. */
export class ManualUpdateChecker {
  private readonly options: Options;
  private state: UpdateState;
  private pending: PendingCheck | null = null;

  constructor(options: Options) {
    this.options = options;
    this.state = {
      phase: "idle",
      currentVersion: options.currentVersion,
      latestVersion: null,
      releaseUrl: null,
      releaseNotes: "",
      downloadProgress: null,
      checkedAt: null,
      message: "Chưa kiểm tra cập nhật.",
    };
  }

  snapshot(): UpdateState {
    return { ...this.state };
  }

  check(): Promise<UpdateState> {
    if (this.pending) return this.pending.promise;
    let resolve!: (state: UpdateState) => void;
    const promise = new Promise<UpdateState>((complete) => {
      resolve = complete;
    });
    const job = {
      controller: new AbortController(),
      previous: this.snapshot(),
      promise,
    };
    // Establish coalescing before notifying the shell, including reentrant calls.
    this.pending = job;
    this.publish({
      ...this.state,
      phase: "checking",
      message: "Đang kiểm tra cập nhật…",
    });
    void this.run(job).then(resolve);
    return promise;
  }

  cancel(): void {
    const job = this.pending;
    if (!job) return;
    this.pending = null;
    this.state = { ...job.previous };
    job.controller.abort(new CancelledCheck());
  }

  private publish(state: UpdateState): void {
    this.state = state;
    this.options.onChange(this.snapshot());
  }

  private async request(signal: AbortSignal): Promise<unknown> {
    const response = await (this.options.fetcher ?? fetch)(RELEASES_API, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "TinNhan-Update-Check",
      },
      signal,
    });
    signal.throwIfAborted();
    if (
      response.redirected ||
      (response.url && response.url !== RELEASES_API)
    ) {
      void response.body?.cancel().catch(() => {});
      return invalidRelease();
    }
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 404) return NO_PUBLIC_RELEASE;
      if (response.status === 403 || response.status === 429) {
        throw new CheckFailure(
          "GitHub đang giới hạn lượt kiểm tra. Vui lòng thử lại sau.",
        );
      }
      throw new CheckFailure(
        `Máy chủ cập nhật trả lỗi HTTP ${response.status}. Vui lòng thử lại sau.`,
      );
    }
    return boundedJson(response, signal);
  }

  private async run(job: PendingCheck): Promise<UpdateState> {
    const { signal } = job.controller;
    const timeoutMs = Math.max(
      1,
      Math.min(this.options.timeoutMs ?? 10000, 10000),
    );
    let onAbort!: () => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const timer = setTimeout(() => {
      job.controller.abort(
        new CheckFailure(
          "Đã hết thời gian kiểm tra cập nhật. Vui lòng thử lại.",
        ),
      );
    }, timeoutMs);
    const finished = (
      phase: UpdateState["phase"],
      message: string,
    ): UpdateState => ({
      phase,
      currentVersion: this.options.currentVersion,
      latestVersion: null,
      releaseUrl: null,
      releaseNotes: "",
      downloadProgress: null,
      checkedAt: (this.options.now ?? Date.now)(),
      message,
    });
    let result: UpdateState;
    try {
      signal.throwIfAborted();
      const current = versionParts(this.options.currentVersion);
      if (!current)
        throw new CheckFailure("Phiên bản ứng dụng hiện tại không hợp lệ.");
      if (!["arm64", "x64", "universal"].includes(this.options.arch)) {
        result = finished(
          "unavailable",
          "Chưa có gói cập nhật phù hợp với máy này.",
        );
      } else {
        const value = await Promise.race([this.request(signal), interrupted]);
        if (value === NO_PUBLIC_RELEASE) {
          result = finished(
            "unavailable",
            "Chưa có bản phát hành công khai để kiểm tra.",
          );
        } else {
          const release = inspectRelease(value, current, this.options.arch);
          const phase =
            release.comparison < 0
              ? "ahead"
              : release.comparison === 0
                ? "current"
                : release.compatible
                  ? "available"
                  : "unavailable";
          const message =
            phase === "ahead"
              ? "Bản đang dùng mới hơn bản phát hành công khai."
              : phase === "current"
                ? "Bạn đang dùng phiên bản mới nhất được công bố."
                : phase === "available"
                  ? `Đã có Gom ${release.version}.`
                  : `Đã có phiên bản ${release.version}, nhưng chưa có gói phù hợp với máy này.`;
          result = {
            ...finished(phase, message),
            latestVersion: release.version,
            releaseUrl: phase === "available" ? release.url : null,
            releaseNotes: release.notes,
          };
        }
      }
    } catch (error) {
      if (error instanceof CancelledCheck || this.pending !== job)
        return { ...job.previous };
      result = finished(
        "error",
        error instanceof CheckFailure
          ? error.message
          : "Không thể kết nối để kiểm tra cập nhật. Vui lòng kiểm tra mạng và thử lại.",
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
    if (this.pending !== job) return { ...job.previous };
    this.pending = null;
    this.publish(result);
    return this.snapshot();
  }
}
