import type { Preferences, ProviderId } from "../shared.ts";
import { navigationPolicy } from "./security.ts";
export function notificationAllowed(p: Preferences, id: ProviderId) {
  return !p.paused && p.notifications[id] === "allow";
}
export function validNotificationFrame(
  id: ProviderId,
  url: string,
  isMainFrame: boolean,
  owned: boolean,
) {
  return owned && isMainFrame && navigationPolicy(id, url) === "internal";
}
export function hasUnread(values: { count: number | null }[]) {
  return values.some((v) => v.count !== null && v.count > 0);
}
