import type {
  Preferences,
  ProviderId,
  AccountId,
  ProviderDefinition,
} from "../shared.ts";
import { navigationPolicy } from "./security.ts";
export function notificationAllowed(p: Preferences, id: AccountId) {
  return !notificationsPaused(p) && p.notifications[id] === "allow";
}
export function notificationsPaused(p: Preferences, now = Date.now()) {
  return p.paused || !!(p.focus && p.focus.endsAt > now);
}
export function validNotificationFrame(
  id: ProviderId,
  url: string,
  isMainFrame: boolean,
  owned: boolean,
  providers?: readonly ProviderDefinition[],
) {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    owned &&
    isMainFrame &&
    host !== "accounts.google.com" &&
    navigationPolicy(id, url, providers) === "internal"
  );
}
export function hasUnread(values: { count: number | null }[]) {
  return values.some((v) => v.count !== null && v.count > 0);
}
