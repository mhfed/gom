import type { Presentation } from "../shared.ts";
export function sidebarWidth(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(200, Math.min(300, Math.round(raw)))
    : 224;
}
export function normalizePresentation(
  raw: unknown,
  ids: string[],
): Presentation {
  const value = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<Presentation>;
  return {
    sidebarWidth: sidebarWidth(value.sidebarWidth),
    theme: ["platform", "system", "light", "dark"].includes(value.theme ?? "")
      ? value.theme!
      : "platform",
    pinned: Array.isArray(value.pinned)
      ? [
          ...new Set(
            value.pinned.filter(
              (id) => typeof id === "string" && ids.includes(id),
            ),
          ),
        ]
      : [],
  };
}
