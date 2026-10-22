import { PROVIDERS, type ProviderId } from "../shared.ts";
export function validProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}
export function navigationPolicy(
  id: ProviderId,
  raw: string,
): "internal" | "external" | "blocked" {
  try {
    const url = new URL(raw);
    if (
      url.username ||
      url.password ||
      url.port ||
      !["https:", "http:"].includes(url.protocol)
    )
      return "blocked";
    return url.protocol === "https:" &&
      (PROVIDERS[id].hosts as readonly string[]).includes(url.hostname)
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
