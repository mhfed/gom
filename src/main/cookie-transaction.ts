export interface LoginCookie {
  url: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
}
interface Jar {
  get(filter: { domain: string; name?: string }): Promise<
    {
      name: string;
      value: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      expirationDate?: number;
      sameSite?: LoginCookie["sameSite"];
    }[]
  >;
  set(cookie: LoginCookie): Promise<void>;
  remove(url: string, name: string): Promise<void>;
  flushStore(): Promise<void>;
}
function cookieHostInScope(host: string, scopes: readonly string[]) {
  const normalized = host.replace(/^\./, "").toLowerCase();
  return scopes.some(
    (scope) => normalized === scope || normalized.endsWith("." + scope),
  );
}
function cookieKey(cookie: { name: string; domain?: string; path?: string }) {
  return JSON.stringify([cookie.domain ?? "", cookie.path ?? "/", cookie.name]);
}
export async function replaceProviderCookies(
  jar: Jar,
  incoming: LoginCookie[],
  allowedDomains: readonly string[],
  allowedNames: readonly string[],
  verify?: () => Promise<boolean>,
  requireNoCollision = true,
): Promise<void> {
  const unique = new Map<string, LoginCookie>();
  for (const cookie of incoming) {
    let url: URL;
    try {
      url = new URL(cookie.url);
    } catch {
      throw new Error("invalid-provider-cookies");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !cookie.name ||
      !allowedNames.includes(cookie.name) ||
      !cookie.path.startsWith("/") ||
      !cookieHostInScope(cookie.domain, allowedDomains) ||
      url.hostname.toLowerCase() !==
        cookie.domain.replace(/^\./, "").toLowerCase()
    )
      throw new Error("invalid-provider-cookies");
    unique.set(cookieKey(cookie), cookie);
  }
  const selected = [...unique.values()];
  if (!selected.length) throw new Error("invalid-provider-cookies");
  const beforeMap = new Map<string, Awaited<ReturnType<Jar["get"]>>[number]>();
  for (const domain of allowedDomains) {
    for (const name of allowedNames) {
      for (const cookie of await jar.get({ domain, name })) {
        if (
          cookie.name === name &&
          cookie.domain &&
          cookieHostInScope(cookie.domain, allowedDomains)
        )
          beforeMap.set(cookieKey(cookie), cookie);
      }
    }
  }
  const before = [...beforeMap.values()];
  if (
    requireNoCollision &&
    selected.some((cookie) => beforeMap.has(cookieKey(cookie)))
  )
    throw new Error("destination-has-session");
  try {
    for (const cookie of selected) await jar.set(cookie);
    await jar.flushStore();
    if (verify && !(await verify())) throw new Error("verification-failed");
  } catch {
    try {
      for (const cookie of selected) await jar.remove(cookie.url, cookie.name);
      for (const cookie of before) {
        const domain = cookie.domain!;
        await jar.set({
          url: `https://${domain.replace(/^\./, "")}/`,
          name: cookie.name,
          value: cookie.value,
          domain,
          path: cookie.path ?? "/",
          secure: !!cookie.secure,
          httpOnly: !!cookie.httpOnly,
          ...(cookie.expirationDate !== undefined
            ? { expirationDate: cookie.expirationDate }
            : {}),
          ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
        });
      }
      await jar.flushStore();
    } catch {
      throw new Error("rollback-failed");
    }
    throw new Error("commit-failed");
  }
}
export async function replaceLoginCookies(
  jar: Jar,
  incoming: LoginCookie[],
  verify?: () => Promise<boolean>,
  requireEmptyDestination = false,
): Promise<void> {
  if (
    incoming.length !== 2 ||
    new Set(incoming.map((x) => x.name)).size !== 2 ||
    incoming.some(
      (x) =>
        !["c_user", "xs"].includes(x.name) ||
        ![".facebook.com", "facebook.com"].includes(x.domain) ||
        x.path !== "/" ||
        x.url !== "https://www.facebook.com/",
    )
  )
    throw new Error("invalid-login-pair");
  const before = (
    await Promise.all(
      ["c_user", "xs"].map((name) =>
        jar.get({ domain: "facebook.com", name }),
      ),
    )
  )
    .flat()
    .filter(
      (x) =>
        ["c_user", "xs"].includes(x.name) &&
        ["facebook.com", ".facebook.com"].includes(x.domain ?? "") &&
        x.path === "/",
    );
  if (requireEmptyDestination && before.length)
    throw new Error("destination-has-session");
  try {
    for (const cookie of incoming) await jar.set(cookie);
    await jar.flushStore();
    if (verify && !(await verify())) throw new Error("verification-failed");
  } catch {
    try {
      for (const cookie of incoming) await jar.remove(cookie.url, cookie.name);
      for (const cookie of before)
        await jar.set({
          ...cookie,
          url: "https://www.facebook.com/",
          domain: cookie.domain!,
          path: "/",
          secure: !!cookie.secure,
          httpOnly: !!cookie.httpOnly,
        });
      await jar.flushStore();
    } catch {
      throw new Error("rollback-failed");
    }
    throw new Error("commit-failed");
  }
}
