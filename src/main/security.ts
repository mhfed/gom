import { type ProviderDefinition, type ProviderId } from "../shared.ts";
import {
  customProviderIdPattern,
  defaultProviders,
  isBuiltinProviderId,
} from "./providers.ts";
export function validProviderId(value: unknown): value is ProviderId {
  return (
    isBuiltinProviderId(value) ||
    (typeof value === "string" && customProviderIdPattern.test(value))
  );
}
const isSlackHost = (hostname: string) =>
  hostname === "slack.com" || hostname.endsWith(".slack.com");
const isGoogleSignInUrl = (url: URL) =>
  url.protocol === "https:" &&
  !url.port &&
  url.hostname === "accounts.google.com" &&
  /^\/(?:o\/oauth2(?:\/|$)|v\d+\/signin(?:\/|$)|signin(?:\/|$)|ServiceLogin(?:\/|$)|AccountChooser(?:\/|$)|InteractiveLogin(?:\/|$)|gsi\/)/i.test(
    url.pathname,
  );
export function navigationPolicy(
  id: ProviderId,
  raw: string,
  providers: readonly ProviderDefinition[] = defaultProviders(),
): "internal" | "external" | "blocked" {
  try {
    const url = new URL(raw);
    const provider = providers.find((candidate) => candidate.id === id);
    if (
      !provider ||
      url.username ||
      url.password ||
      !["https:", "http:"].includes(url.protocol)
    )
      return "blocked";
    if (provider.custom) {
      const entry = new URL(provider.entry);
      const trustedSlackRedirect =
        url.protocol === "https:" &&
        !url.port &&
        isSlackHost(entry.hostname) &&
        isSlackHost(url.hostname);
      return url.origin === entry.origin ||
        trustedSlackRedirect ||
        isGoogleSignInUrl(url)
        ? "internal"
        : "external";
    }
    if (url.port) return "blocked";
    const trustedSlackHost =
      provider.id === "slack" && isSlackHost(url.hostname);
    const trustedHost =
      provider.hosts.includes(url.hostname) || trustedSlackHost;
    return url.protocol === "https:" &&
      trustedHost &&
      (url.hostname !== "accounts.google.com" || isGoogleSignInUrl(url))
      ? "internal"
      : "external";
  } catch {
    return "blocked";
  }
}
export function trustedShellRequest(
  sender: unknown,
  frame: unknown,
  shell: unknown,
  mainFrame: unknown,
) {
  return sender === shell && frame === mainFrame && !!mainFrame;
}
