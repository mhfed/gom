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
  get(filter: { domain: string }): Promise<
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
export async function replaceLoginCookies(
  jar: Jar,
  incoming: LoginCookie[],
  verify?: () => Promise<boolean>,
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
  const before = (await jar.get({ domain: "facebook.com" })).filter(
    (x) =>
      ["c_user", "xs"].includes(x.name) &&
      ["facebook.com", ".facebook.com"].includes(x.domain ?? "") &&
      x.path === "/",
  );
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
