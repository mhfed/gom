import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
export function decodeChromeCookie(
  cookie: { host: string; encrypted: string; plain: string },
  key: Buffer,
  version: number,
): string {
  if (cookie.plain) return cookie.plain;
  if (!/^[\da-f]+$/i.test(cookie.encrypted) || cookie.encrypted.length % 2)
    throw new Error("invalid-source");
  const bytes = Buffer.from(cookie.encrypted, "hex");
  if (!["v10", "v11"].includes(bytes.subarray(0, 3).toString("ascii")))
    throw new Error("unsupported-format");
  const cipher = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20));
  let decoded = Buffer.concat([
    cipher.update(bytes.subarray(3)),
    cipher.final(),
  ]);
  if (version >= 24) {
    const hash = createHash("sha256").update(cookie.host).digest();
    if (decoded.length < 32 || !timingSafeEqual(hash, decoded.subarray(0, 32)))
      throw new Error("invalid-source");
    decoded = decoded.subarray(32);
  }
  return decoded.toString("utf8");
}

export async function decodeWindowsChromeCookie(
  cookie: { host: string; encrypted: string; plain: string },
  key: Buffer | undefined,
  version: number,
  unprotect: (data: Buffer) => Promise<Buffer>,
): Promise<string> {
  if (cookie.plain) return cookie.plain;
  if (!/^[\da-f]+$/i.test(cookie.encrypted) || cookie.encrypted.length % 2)
    throw new Error("invalid-source");
  const bytes = Buffer.from(cookie.encrypted, "hex");
  const format = bytes.subarray(0, 3).toString("ascii");
  if (format === "v20") throw new Error("app-bound");
  if (format !== "v10") {
    const decoded = await unprotect(bytes);
    try {
      return decoded.toString("utf8");
    } finally {
      decoded.fill(0);
      bytes.fill(0);
    }
  }
  if (!key || key.length !== 32 || bytes.length < 3 + 12 + 16)
    throw new Error("unsupported-format");
  const nonce = bytes.subarray(3, 15);
  const authTag = bytes.subarray(bytes.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);
  let decoded: Buffer;
  try {
    decoded = Buffer.concat([
      decipher.update(bytes.subarray(15, bytes.length - 16)),
      decipher.final(),
    ]);
  } finally {
    bytes.fill(0);
  }
  try {
    if (version >= 24) {
      const hash = createHash("sha256").update(cookie.host).digest();
      if (
        decoded.length < hash.length ||
        !timingSafeEqual(hash, decoded.subarray(0, hash.length))
      )
        throw new Error("invalid-source");
      return decoded.subarray(hash.length).toString("utf8");
    }
    return decoded.toString("utf8");
  } finally {
    decoded.fill(0);
  }
}

export function chromiumExpiry(microseconds: number): number | undefined {
  return microseconds === 0
    ? undefined
    : microseconds / 1_000_000 - 11_644_473_600;
}
