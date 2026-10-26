import assert from "node:assert/strict";
import { test } from "node:test";
import { ManualUpdateChecker, RELEASES_URL } from "../src/main/update-check.ts";
import type { UpdateState } from "../src/update-types.ts";

const API = "https://api.github.com/repos/mhfed/gom/releases/latest";
function release(version = "0.5.10", arch = "arm64", extension = "dmg") {
  const tag = `v${version}`;
  const name = `TinNhan-macOS-${arch}-${version}.${extension}`;
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    html_url: `${RELEASES_URL}/tag/${tag}`,
    body: "Bản mới\n- Giữ phiên đăng nhập.",
    assets: [
      { name, browser_download_url: `${RELEASES_URL}/download/${tag}/${name}` },
    ],
  };
}
function releaseWithAsset(name: string) {
  const metadata = release("0.6.0");
  metadata.assets = [
    {
      name,
      browser_download_url: `${RELEASES_URL}/download/v0.6.0/${encodeURIComponent(name)}`,
    },
  ];
  return metadata;
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}
function setup(
  fetcher: typeof fetch = async () => response(release()),
  options: { currentVersion?: string; arch?: string; timeoutMs?: number } = {},
) {
  const changes: UpdateState[] = [];
  const checker = new ManualUpdateChecker({
    currentVersion: "0.5.9",
    arch: "arm64",
    now: () => 123456,
    ...options,
    fetcher,
    onChange: (state) => changes.push(state),
  });
  return { checker, changes };
}

test("fetches the fixed public source without credentials and orders numeric semver", async () => {
  let request: { url: unknown; init?: RequestInit } | undefined;
  const { checker, changes } = setup(async (url, init) => {
    request = { url, init };
    return response(release());
  });
  assert.equal(checker.snapshot().phase, "idle");
  const result = await checker.check();
  assert.equal(request?.url, API);
  assert.equal(request?.init?.credentials, "omit");
  assert.equal(request?.init?.redirect, "error");
  assert.ok(request?.init?.signal);
  const headers = new Headers(request?.init?.headers);
  assert.equal(headers.has("authorization"), false);
  assert.equal(headers.has("cookie"), false);
  assert.equal(result.phase, "available");
  assert.equal(result.latestVersion, "0.5.10");
  assert.equal(result.releaseUrl, `${RELEASES_URL}/tag/v0.5.10`);
  assert.equal(result.checkedAt, 123456);
  assert.deepEqual(
    changes.map((state) => state.phase),
    ["checking", "available"],
  );
});

test("discovers a release from the renamed canonical Gom repository without redirects", async () => {
  const canonicalApi = "https://api.github.com/repos/mhfed/gom/releases/latest";
  const metadata = {
    tag_name: "v0.6.2",
    draft: false,
    prerelease: false,
    html_url: "https://github.com/mhfed/gom/releases/tag/v0.6.2",
    body: "Cập nhật Gom.",
    assets: [
      {
        name: "Gom-macOS-arm64-0.6.2.dmg",
        browser_download_url:
          "https://github.com/mhfed/gom/releases/download/v0.6.2/Gom-macOS-arm64-0.6.2.dmg",
      },
    ],
  };
  const { checker } = setup(
    async (url) => {
      // The former slug now returns a redirect, which the checker must not follow.
      if (url !== canonicalApi) return response({}, 301);
      const reply = response(metadata);
      Object.defineProperty(reply, "url", { value: canonicalApi });
      return reply;
    },
    { currentVersion: "0.6.0" },
  );
  const result = await checker.check();
  assert.equal(result.phase, "available");
  assert.equal(result.latestVersion, "0.6.2");
  assert.equal(
    result.releaseUrl,
    "https://github.com/mhfed/gom/releases/tag/v0.6.2",
  );
});

test("rejects release and download URLs using the former repository slug", async () => {
  const oldRelease = release();
  oldRelease.html_url =
    "https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.5.10";
  const oldAsset = release();
  oldAsset.assets[0].browser_download_url =
    "https://github.com/mhfed/tin-nhan-desktop/releases/download/v0.5.10/TinNhan-macOS-arm64-0.5.10.dmg";
  for (const metadata of [oldRelease, oldAsset]) {
    const { checker } = setup(async () => response(metadata));
    const result = await checker.check();
    assert.equal(result.phase, "error");
    assert.equal(result.releaseUrl, null);
  }
});

test("distinguishes the same and an older published version", async () => {
  for (const [version, phase] of [
    ["0.5.9", "current"],
    ["0.5.8", "ahead"],
    ["0.6.0", "available"],
    ["1.0.0", "available"],
  ]) {
    const { checker } = setup(async () => response(release(version)));
    assert.equal((await checker.check()).phase, phase, version);
  }
});

test("accepts stable unprefixed tags and compatible universal ZIPs", async () => {
  const metadata = release("0.5.10", "universal", "zip");
  metadata.tag_name = "0.5.10";
  metadata.html_url = `${RELEASES_URL}/tag/0.5.10`;
  metadata.assets[0].browser_download_url =
    metadata.assets[0].browser_download_url.replace("/v0.5.10/", "/0.5.10/");
  const { checker } = setup(async () => response(metadata));
  assert.equal((await checker.check()).phase, "available");
});

test("accepts the Forge ZIP filename and encoded spaces in its download URL", async () => {
  const metadata = release();
  metadata.assets[0].name = "Tin Nhan-darwin-arm64-0.5.10.zip";
  metadata.assets[0].browser_download_url = `${RELEASES_URL}/download/v0.5.10/${encodeURIComponent(metadata.assets[0].name)}`;
  const { checker } = setup(async () => response(metadata));
  assert.equal((await checker.check()).phase, "available");
});

for (const name of [
  "Gom-macOS-arm64-0.6.0.dmg",
  "Gom-darwin-arm64-0.6.0.zip",
  "TinNhan-macOS-arm64-0.6.0.dmg",
  "Tin Nhan-darwin-arm64-0.6.0.zip",
  "tin-nhan-desktop-darwin-arm64-0.6.0.zip",
]) {
  test(`offers the Gom release with compatible asset ${name}`, async () => {
    const { checker } = setup(async () => response(releaseWithAsset(name)));
    const result = await checker.check();
    assert.equal(result.phase, "available");
    assert.equal(result.latestVersion, "0.6.0");
    assert.equal(result.releaseUrl, `${RELEASES_URL}/tag/v0.6.0`);
    assert.equal(result.message, "Đã có Gom 0.6.0.");
  });
}

test("Gom assets retain exact version, architecture, product and file-type matching", async () => {
  for (const [name, arch, phase] of [
    ["Gom-macOS-x64-0.6.0.dmg", "x64", "available"],
    ["Gom-darwin-universal-0.6.0.zip", "arm64", "available"],
    ["Gom-darwin-universal-0.6.0.zip", "x64", "available"],
    ["Gom-macOS-x64-0.6.0.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0.6.0.dmg", "universal", "unavailable"],
    ["Gom-macOS-arm64-0.5.9.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0.6.0-beta.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-00.6.0.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0x6x0.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0.6.0.exe", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0.6.0.dmg.zip", "arm64", "unavailable"],
    ["GomPlus-macOS-arm64-0.6.0.dmg", "arm64", "unavailable"],
    ["../Gom-macOS-arm64-0.6.0.dmg", "arm64", "unavailable"],
    ["Gom-macOS-arm64-0.6.0.dmg\n", "arm64", "unavailable"],
  ]) {
    const { checker } = setup(async () => response(releaseWithAsset(name)), {
      arch,
    });
    const result = await checker.check();
    assert.equal(result.phase, phase, `${name} on ${arch}`);
    assert.equal(
      result.releaseUrl,
      phase === "available" ? `${RELEASES_URL}/tag/v0.6.0` : null,
    );
  }
});

test("Gom assets still require the exact trusted download URL", async () => {
  for (const browser_download_url of [
    "https://evil.example/Gom-macOS-arm64-0.6.0.dmg",
    "https://github.com.evil.example/mhfed/gom/releases/download/v0.6.0/Gom-macOS-arm64-0.6.0.dmg",
    "https://github.com/mhfed/other/releases/download/v0.6.0/Gom-macOS-arm64-0.6.0.dmg",
    `${RELEASES_URL}/download/v0.5.9/Gom-macOS-arm64-0.6.0.dmg`,
    `${RELEASES_URL}/download/v0.6.0/TinNhan-macOS-arm64-0.6.0.dmg`,
    `${RELEASES_URL}/download/v0.6.0/Gom-macOS-arm64-0.6.0.dmg?download=evil`,
  ]) {
    const metadata = releaseWithAsset("Gom-macOS-arm64-0.6.0.dmg");
    metadata.assets[0].browser_download_url = browser_download_url;
    const { checker } = setup(async () => response(metadata));
    const result = await checker.check();
    assert.equal(result.phase, "error", browser_download_url);
    assert.equal(result.releaseUrl, null);
  }
});

test("does not offer an incompatible, absent, or mismatched-version asset", async () => {
  const candidates = [
    release("0.5.10", "x64"),
    release("0.5.10", "arm"),
    release("0.5.10", "arm64", "exe"),
  ];
  candidates.push({ ...release(), assets: [] });
  const staleAsset = release();
  staleAsset.assets = release("0.5.1").assets;
  candidates.push(staleAsset);
  const prereleaseAsset = release();
  prereleaseAsset.assets[0].name = "TinNhan-macOS-arm64-0.5.10-beta.dmg";
  candidates.push(prereleaseAsset);
  for (const metadata of candidates) {
    const { checker } = setup(async () => response(metadata));
    const result = await checker.check();
    assert.equal(result.phase, "unavailable", JSON.stringify(metadata.assets));
    assert.equal(result.latestVersion, "0.5.10");
    assert.equal(result.releaseUrl, null);
  }
});

test("rejects prereleases, drafts, malformed metadata and non-exact versions", async () => {
  const candidates: unknown[] = [
    null,
    [],
    {},
    { ...release(), draft: true },
    { ...release(), prerelease: true },
    { ...release(), draft: "false" },
    { ...release(), assets: null },
    { ...release(), body: {} },
  ];
  for (const tag_name of [
    "v0.5.10-beta.1",
    "v0.5.10+build",
    "v00.5.10",
    "0.5",
    "v0.5.10/../../evil",
    "v0.5.10\n",
    "latest",
  ])
    candidates.push({ ...release(), tag_name });
  for (const metadata of candidates) {
    const { checker } = setup(async () => response(metadata));
    const result = await checker.check();
    assert.equal(result.phase, "error", JSON.stringify(metadata));
    assert.equal(result.releaseUrl, null);
  }
});

test("rejects spoofed hosts, repositories, credentials, ports and deceptive release URLs", async () => {
  const malicious = [
    "https://github.com.evil.example/mhfed/gom/releases/tag/v0.5.10",
    "https://github.com@evil.example/mhfed/gom/releases/tag/v0.5.10",
    "https://github.com/other/gom/releases/tag/v0.5.10",
    `${RELEASES_URL}/tag/v0.5.11`,
    `${RELEASES_URL}/tag/v0.5.10?redirect=https://evil.example`,
    `${RELEASES_URL}/tag/v0.5.10#redirect`,
    "http://github.com/mhfed/gom/releases/tag/v0.5.10",
    "https://github.com:444/mhfed/gom/releases/tag/v0.5.10",
    "https://user@github.com/mhfed/gom/releases/tag/v0.5.10",
    "javascript:alert(1)",
  ];
  for (const html_url of malicious) {
    const { checker } = setup(async () => response({ ...release(), html_url }));
    const result = await checker.check();
    assert.equal(result.phase, "error", html_url);
    assert.equal(result.releaseUrl, null);
  }
});

test("rejects a deceptive or wrong-version download URL for a compatible asset", async () => {
  for (const url of [
    "https://evil.example/TinNhan-macOS-arm64-0.5.10.dmg",
    `${RELEASES_URL}/download/v0.5.9/TinNhan-macOS-arm64-0.5.10.dmg`,
    `${RELEASES_URL}/download/v0.5.10/TinNhan-macOS-arm64-0.5.10.dmg?download=evil`,
    "https://github.com.evil.example/mhfed/gom/releases/download/v0.5.10/TinNhan-macOS-arm64-0.5.10.dmg",
  ]) {
    const metadata = release();
    metadata.assets[0].browser_download_url = url;
    const { checker } = setup(async () => response(metadata));
    assert.equal((await checker.check()).phase, "error", url);
  }
});

test("keeps release notes as bounded plain text and isolates state snapshots", async () => {
  const metadata = release();
  metadata.body =
    "<img src=x onerror=alert(1)>\r\n\u0000\u202e" + "x".repeat(20000);
  const { checker, changes } = setup(async () => response(metadata));
  const result = await checker.check();
  assert.ok(result.releaseNotes.startsWith("<img src=x onerror=alert(1)>\n"));
  assert.equal(result.releaseNotes.includes("\r"), false);
  assert.equal(result.releaseNotes.includes("\u0000"), false);
  assert.equal(result.releaseNotes.includes("\u202e"), false);
  assert.ok(result.releaseNotes.length <= 12000);
  result.phase = "error";
  changes[1].releaseUrl = "https://evil.example";
  assert.equal(checker.snapshot().phase, "available");
  assert.equal(checker.snapshot().releaseUrl, `${RELEASES_URL}/tag/v0.5.10`);
});

test("404 means no public release and rate limits, server errors and offline never mean current", async () => {
  for (const status of [404, 403, 429, 500]) {
    const { checker } = setup(async () => response({}, status));
    const result = await checker.check();
    assert.equal(result.phase, status === 404 ? "unavailable" : "error");
    assert.equal(result.releaseUrl, null);
    assert.equal(result.checkedAt, 123456);
    if (status === 403 || status === 429)
      assert.match(result.message, /giới hạn/);
  }
  const { checker } = setup(async () => {
    throw new TypeError("offline");
  });
  assert.equal((await checker.check()).phase, "error");
});

test("a failed recheck clears a previous available result and can be retried", async () => {
  let calls = 0;
  const { checker } = setup(async () =>
    ++calls === 2 ? response({}, 500) : response(release()),
  );
  assert.equal((await checker.check()).phase, "available");
  const failed = await checker.check();
  assert.equal(failed.phase, "error");
  assert.equal(failed.releaseUrl, null);
  assert.equal(failed.latestVersion, null);
  assert.equal((await checker.check()).phase, "available");
});

test("rejects invalid JSON and response redirection even if a fetcher ignores redirect policy", async () => {
  const malformed = new Response("not json");
  const redirected = response(release());
  Object.defineProperty(redirected, "redirected", { value: true });
  const wrongUrl = response(release());
  Object.defineProperty(wrongUrl, "url", {
    value: "https://evil.example/releases/latest",
  });
  for (const reply of [malformed, redirected, wrongUrl]) {
    const { checker } = setup(async () => reply);
    assert.equal((await checker.check()).phase, "error");
  }
});

test("rejects oversized Content-Length before reading the body", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const reply = new Response(body, {
    headers: { "content-length": String(512 * 1024 + 1) },
  });
  const { checker } = setup(async () => reply);
  const result = await checker.check();
  assert.equal(result.phase, "error");
  assert.match(result.message, /lớn/);
  assert.equal(cancelled, true);
});

test("limits streamed bytes even without Content-Length and cancels the source", async () => {
  let cancelled = false;
  let chunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(128 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const { checker } = setup(async () => new Response(body));
  const result = await checker.check();
  assert.equal(result.phase, "error");
  assert.match(result.message, /lớn/);
  assert.equal(cancelled, true);
  assert.ok(chunks <= 6);
});

test("timeout covers a fetcher that ignores AbortSignal", async () => {
  let signal: AbortSignal | null | undefined;
  const { checker } = setup(
    (_url, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    },
    { timeoutMs: 20 },
  );
  const result = await checker.check();
  assert.equal(result.phase, "error");
  assert.match(result.message, /hết thời gian/i);
  assert.equal(signal?.aborted, true);
});

test("timeout also covers a stalled response body and cancels it", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const { checker } = setup(async () => new Response(body), { timeoutMs: 20 });
  const result = await checker.check();
  assert.equal(result.phase, "error");
  assert.match(result.message, /hết thời gian/i);
  assert.equal(cancelled, true);
});

test("coalesces concurrent requests into one promise and publishes once", async () => {
  let finish!: (response: Response) => void;
  let calls = 0;
  const { checker, changes } = setup(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = checker.check();
  const second = checker.check();
  assert.equal(first, second);
  assert.equal(calls, 1);
  finish(response(release()));
  assert.equal((await first).phase, "available");
  assert.equal((await second).phase, "available");
  assert.deepEqual(
    changes.map((state) => state.phase),
    ["checking", "available"],
  );
});

test("cancellation prevents late state publication and permits a new check", async () => {
  let finish!: (response: Response) => void;
  let calls = 0;
  const { checker, changes } = setup(() =>
    ++calls === 1
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(response(release())),
  );
  const first = checker.check();
  checker.cancel();
  assert.equal(checker.snapshot().phase, "idle");
  assert.equal((await first).phase, "idle");
  await checker.check();
  finish(response(release("99.0.0")));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(checker.snapshot().latestVersion, "0.5.10");
  assert.deepEqual(
    changes.map((state) => state.phase),
    ["checking", "checking", "available"],
  );
});

test("rejects a trailing newline even when its tag URL repeats that deceptive tag", async () => {
  const metadata = release();
  metadata.tag_name += "\n";
  metadata.html_url += "\n";
  const { checker } = setup(async () => response(metadata));
  assert.equal((await checker.check()).phase, "error");
});

test("matches Intel and universal DMGs but never another architecture", async () => {
  for (const [assetArch, phase] of [
    ["x64", "available"],
    ["universal", "available"],
    ["arm64", "unavailable"],
  ]) {
    const { checker } = setup(
      async () => response(release("0.5.10", assetArch)),
      { arch: "x64" },
    );
    assert.equal((await checker.check()).phase, phase);
  }
  let fetched = false;
  const { checker } = setup(
    async () => {
      fetched = true;
      return response(release());
    },
    { arch: "ia32" },
  );
  assert.equal((await checker.check()).phase, "unavailable");
  assert.equal(fetched, false);
});

test("invalid current versions cannot produce a false up-to-date result", async () => {
  for (const currentVersion of ["latest", "0.5.9-beta", "0.5.9\n", "00.5.9"]) {
    const { checker } = setup(undefined, { currentVersion });
    assert.equal((await checker.check()).phase, "error", currentVersion);
  }
});

test("the response size limit is inclusive and notes remain bounded", async () => {
  const metadata = release();
  const initial = JSON.stringify(metadata);
  metadata.body += " ".repeat(512 * 1024 - Buffer.byteLength(initial));
  assert.equal(Buffer.byteLength(JSON.stringify(metadata)), 512 * 1024);
  const { checker } = setup(async () => response(metadata));
  assert.equal((await checker.check()).phase, "available");
});

test("coalesces a reentrant check made by the change callback", async () => {
  let nested: Promise<UpdateState> | undefined;
  let calls = 0;
  const checker = new ManualUpdateChecker({
    currentVersion: "0.5.9",
    arch: "arm64",
    fetcher: async () => {
      calls++;
      return response(release());
    },
    onChange: (state) => {
      if (state.phase === "checking") nested = checker.check();
    },
  });
  const first = checker.check();
  assert.equal(first, nested);
  assert.equal((await first).phase, "available");
  assert.equal(calls, 1);
});

test("cancellation from the change callback settles without making a request", async () => {
  let fetched = false;
  const checker = new ManualUpdateChecker({
    currentVersion: "0.5.9",
    arch: "arm64",
    fetcher: async () => {
      fetched = true;
      return response(release());
    },
    onChange: (state) => {
      if (state.phase === "checking") checker.cancel();
    },
  });
  assert.equal((await checker.check()).phase, "idle");
  assert.equal(fetched, false);
});

test("rejects an asset filename with a trailing control character", async () => {
  const metadata = release();
  metadata.assets[0].name += "\n";
  metadata.assets[0].browser_download_url = `${RELEASES_URL}/download/v0.5.10/${encodeURIComponent(metadata.assets[0].name)}`;
  const { checker } = setup(async () => response(metadata));
  assert.equal((await checker.check()).phase, "unavailable");
});
