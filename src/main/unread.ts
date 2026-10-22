import type { UnreadInfo } from "../shared.ts";
export interface UnreadSample {
  global: unknown;
  loaded: number | null;
  kind: UnreadInfo["kind"];
}
export function normalizeUnread(sample: UnreadSample): UnreadInfo {
  const raw =
    typeof sample.global === "number" ? String(sample.global) : sample.global;
  if (typeof raw === "string" && /^\d+(?:,\d{3})*\+?$/.test(raw)) {
    const count = Number(raw.replace(/[,+]/g, ""));
    if (Number.isSafeInteger(count))
      return {
        count,
        kind: sample.kind,
        approximate: raw.endsWith("+"),
        source: "platform",
      };
  }
  if (Number.isSafeInteger(sample.loaded) && sample.loaded! > 0)
    return {
      count: sample.loaded,
      kind: sample.kind,
      approximate: true,
      source: "loaded",
    };
  return {
    count: null,
    kind: sample.kind,
    approximate: false,
    source: "unavailable",
  };
}
export function badgeText(info: UnreadInfo): string {
  if (info.count === null) return "—";
  if (info.count > 99) return "99+";
  return String(info.count) + (info.approximate ? "+" : "");
}
