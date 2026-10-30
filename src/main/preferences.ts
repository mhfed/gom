import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { PROVIDER_ORDER, type Preferences } from "../shared.ts";
import { normalizeFocus } from "./focus.ts";
export const defaultPreferences = (
  ids: string[] = [...PROVIDER_ORDER],
): Preferences => ({
  paused: false,
  shortcut: false,
  updateChecks: true,
  notifications: Object.fromEntries(ids.map((id) => [id, "ask"])),
});
export function normalizePreferences(
  raw: unknown,
  ids: string[] = [...PROVIDER_ORDER],
): Preferences {
  const out = defaultPreferences(ids);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  out.paused = r.paused === true;
  const focus = normalizeFocus(r.focus);
  if (focus) out.focus = focus;
  out.shortcut = r.shortcut === true;
  out.updateChecks = r.updateChecks !== false;
  if (
    r.notifications &&
    typeof r.notifications === "object" &&
    !Array.isArray(r.notifications)
  ) {
    for (const id of ids) {
      const v = (r.notifications as Record<string, unknown>)[id];
      if (v === "allow" || v === "mute" || v === "ask")
        out.notifications[id] = v;
    }
  }
  return out;
}
export type Bounds = { x: number; y: number; width: number; height: number };
export function restoreBounds(raw: unknown, displays: Bounds[]): Bounds {
  const primary = displays[0] ?? { x: 0, y: 0, width: 1440, height: 900 };
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Bounds>;
  const validSize = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const width = validSize(r.width)
    ? Math.max(940, Math.min(r.width!, 1800))
    : 1280;
  const height = validSize(r.height)
    ? Math.max(640, Math.min(r.height!, 1200))
    : 840;
  const hasPosition = Number.isFinite(r.x) && Number.isFinite(r.y);
  const display = hasPosition
    ? (displays.find(
        (d) =>
          r.x! >= d.x &&
          r.x! < d.x + d.width &&
          r.y! >= d.y &&
          r.y! < d.y + d.height,
      ) ?? primary)
    : primary;
  const w = Math.min(width, display.width),
    h = Math.min(height, display.height);
  const positionVisible =
    hasPosition &&
    r.x! >= display.x &&
    r.x! < display.x + display.width &&
    r.y! >= display.y &&
    r.y! < display.y + display.height;
  return {
    x: positionVisible
      ? Math.max(display.x, Math.min(r.x!, display.x + display.width - w))
      : display.x + Math.floor((display.width - w) / 2),
    y: positionVisible
      ? Math.max(display.y, Math.min(r.y!, display.y + display.height - h))
      : display.y + Math.floor((display.height - h) / 2),
    width: w,
    height: h,
  };
}
export class SettingsWriter {
  private tail: Promise<void> = Promise.resolve();
  private path: string;
  constructor(path: string) {
    this.path = path;
  }
  write(value: unknown): Promise<void> {
    const json = JSON.stringify(value);
    const task = this.tail
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true });
        await writeFile(this.path + ".tmp", json, { mode: 0o600 });
        await rename(this.path + ".tmp", this.path);
      });
    this.tail = task;
    return task;
  }
}
