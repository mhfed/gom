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
    if (provider.custom)
      return url.origin === new URL(provider.entry).origin
        ? "internal"
        : "external";
    if (url.port) return "blocked";
    return url.protocol === "https:" && provider.hosts.includes(url.hostname)
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
