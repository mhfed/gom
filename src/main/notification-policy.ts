import type {
  Preferences,
  ProviderId,
  AccountId,
  ProviderDefinition,
} from "../shared.ts";
import { navigationPolicy } from "./security.ts";
export function notificationAllowed(p: Preferences, id: AccountId) {
  return !p.paused && p.notifications[id] === "allow";
}
export function validNotificationFrame(
  id: ProviderId,
  url: string,
  isMainFrame: boolean,
  owned: boolean,
  providers?: readonly ProviderDefinition[],
) {
  return (
    owned && isMainFrame && navigationPolicy(id, url, providers) === "internal"
  );
}
export function hasUnread(values: { count: number | null }[]) {
  return values.some((v) => v.count !== null && v.count > 0);
}
