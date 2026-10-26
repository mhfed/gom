import { randomUUID } from "node:crypto";
import {
  PROVIDERS,
  PROVIDER_ORDER,
  type BuiltinProviderId,
  type ProviderDefinition,
} from "../shared.ts";

export const customProviderIdPattern =
  /^web_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isBuiltinProviderId(
  value: unknown,
): value is BuiltinProviderId {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}

export function defaultProviders(): ProviderDefinition[] {
  return PROVIDER_ORDER.map((id) => ({
    ...PROVIDERS[id],
    hosts: [...PROVIDERS[id].hosts],
  }));
}

export function createCustomProvider(
  name: string,
  raw: string,
  uuid: string = randomUUID(),
): ProviderDefinition {
  if (typeof name !== "string" || typeof raw !== "string")
    throw Error("invalid-provider");
  const label = Array.from(
    name.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim(),
  )
    .slice(0, 40)
    .join("");
  const id = `web_${uuid}` as const;
  if (!label || !customProviderIdPattern.test(id) || raw.length > 4096)
    throw Error("invalid-provider");
  if (!/^https?:\/\/[^/]/i.test(raw.trim()))
    throw Error("invalid-provider-url");
  let entry: URL;
  try {
    entry = new URL(raw.trim());
  } catch {
    throw Error("invalid-provider-url");
  }
  if (
    !["http:", "https:"].includes(entry.protocol) ||
    entry.username ||
    entry.password ||
    !entry.hostname ||
    /[\u0000-\u0020\u007f\\]/.test(raw.trim())
  )
    throw Error("invalid-provider-url");
  // URL parses IP literals itself; validate DNS labels rather than accepting
  // malformed hostnames such as underscores or empty interior labels.
  const host = entry.hostname.replace(/\.$/, "");
  if (
    !host.startsWith("[") &&
    (host.length > 253 ||
      host
        .split(".")
        .some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)))
  )
    throw Error("invalid-provider-url");
  return {
    id,
    label,
    entry: entry.href,
    hosts: [entry.hostname],
    color: "#087f7a",
    custom: true,
  };
}

/** Persist only user-owned metadata; hosts and trust are derived from the URL. */
export function customProviderMetadata(
  providers: readonly ProviderDefinition[],
) {
  return providers
    .filter((provider) => provider.custom)
    .map(({ id, label, entry }) => ({ id, label, entry }));
}

export function restoreProviders(raw: unknown): ProviderDefinition[] {
  if (!Array.isArray(raw) || raw.length > 100) throw Error("invalid-providers");
  const seen = new Set<string>();
  const custom = raw.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("invalid-provider");
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !customProviderIdPattern.test(item.id) ||
      seen.has(item.id) ||
      typeof item.label !== "string" ||
      typeof item.entry !== "string"
    )
      throw Error("invalid-provider");
    seen.add(item.id);
    return createCustomProvider(item.label, item.entry, item.id.slice(4));
  });
  return [...defaultProviders(), ...custom];
}
