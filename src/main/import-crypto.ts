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
export function chromiumExpiry(microseconds: number): number | undefined {
  return microseconds === 0
    ? undefined
    : microseconds / 1_000_000 - 11_644_473_600;
}
