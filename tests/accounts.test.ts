import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ChromeSources } from "../src/main/local-accounts.ts";
import {
  replaceLoginCookies,
  type LoginCookie,
} from "../src/main/cookie-transaction.ts";
const execute = promisify(execFile);

test("selected Chrome profile is resolved from metadata; traversal and unlisted profiles are refused", async () => {
  const root = await mkdtemp(join(tmpdir(), "tin-nhan-source-"));
  try {
    await writeFile(
      join(root, "Local State"),
      JSON.stringify({
        profile: {
          info_cache: {
            Default: { name: "Personal", user_name: "fixture@example.test" },
            "Profile 1": { name: "Work", user_name: "work@example.test" },
            "../escape": { name: "Bad" },
          },
        },
      }),
    );
    await mkdir(join(root, "Default"));
    await execute("/usr/bin/sqlite3", [
      join(root, "Default", "Cookies"),
      "CREATE TABLE meta(key TEXT,value TEXT); INSERT INTO meta VALUES('version','24'); CREATE TABLE cookies(host_key TEXT,name TEXT,path TEXT,is_secure INT,is_httponly INT,expires_utc INT,encrypted_value BLOB,value TEXT); INSERT INTO cookies VALUES('.facebook.com','c_user','/',1,1,0,X'76313000',''); INSERT INTO cookies VALUES('.facebook.com','xs','/',1,1,0,X'76313001',''); INSERT INTO cookies VALUES('.other.test','private','/',1,1,0,X'010203','unrelated-secret');",
    ]);
    const sources = new ChromeSources(root, "fixture@example.test");
    assert.deepEqual(
      (await sources.list()).map((x) => [x.id, x.preferred]),
      [
        ["Default", true],
        ["Profile 1", false],
      ],
    );
    const result = await sources.read("Default");
    assert.equal(result.version, 24);
    assert.deepEqual(result.cookies.map((x) => x.name).sort(), [
      "c_user",
      "xs",
    ]);
    assert.ok(result.cookies.every((x) => x.host === ".facebook.com"));
    await assert.rejects(sources.read("../escape"));
    await assert.rejects(sources.read("Profile 99"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function cookie(name: string, value: string): LoginCookie {
  return {
    url: "https://www.facebook.com/",
    domain: ".facebook.com",
    name,
    value,
    path: "/",
    secure: true,
    httpOnly: true,
  };
}
test("a partial destination import failure restores old cookies and leaves other service data intact", async () => {
  const existing = [
    cookie("c_user", "old-user"),
    cookie("xs", "old-session"),
    cookie("preferences", "keep"),
  ];
  const store = new Map(existing.map((x) => [x.name, x]));
  let fail = true;
  const jar = {
    async get() {
      return [...store.values()];
    },
    async set(item: LoginCookie) {
      if (item.name === "xs" && item.value === "new-session" && fail) {
        fail = false;
        throw Error("fixture-write-error");
      }
      store.set(item.name, item);
    },
    async remove(_url: string, name: string) {
      store.delete(name);
    },
    async flushStore() {},
  };
  await assert.rejects(
    replaceLoginCookies(jar, [
      cookie("c_user", "new-user"),
      cookie("xs", "new-session"),
    ]),
  );
  assert.equal(store.get("c_user")?.value, "old-user");
  assert.equal(store.get("xs")?.value, "old-session");
  assert.equal(store.get("preferences")?.value, "keep");
});
test("destination import cannot write a foreign cookie or accept only half of the login pair", async () => {
  const store = new Map<string, LoginCookie>();
  const jar = {
    async get() {
      return [];
    },
    async set(item: LoginCookie) {
      store.set(item.name, item);
    },
    async remove() {},
    async flushStore() {},
  };
  await assert.rejects(replaceLoginCookies(jar, [cookie("c_user", "fixture")]));
  await assert.rejects(
    replaceLoginCookies(jar, [
      cookie("c_user", "fixture"),
      { ...cookie("xs", "fixture"), domain: ".attacker.test" },
    ]),
  );
  assert.equal(store.size, 0);
});

test("destination verification failure restores the old pair after a successful write", async () => {
  const values = new Map([
    ["c_user", "old-user"],
    ["xs", "old-session"],
  ]);
  const jar = {
    get: async () =>
      [...values].map(([name, value]) => ({
        name,
        value,
        domain: ".facebook.com",
        path: "/",
        secure: true,
        httpOnly: true,
      })),
    set: async (cookie: LoginCookie) => {
      values.set(cookie.name, cookie.value);
    },
    remove: async (_url: string, name: string) => {
      values.delete(name);
    },
    flushStore: async () => {},
  };
  await assert.rejects(
    replaceLoginCookies(
      jar,
      [
        {
          url: "https://www.facebook.com/",
          domain: ".facebook.com",
          path: "/",
          name: "c_user",
          value: "new-user",
          secure: true,
          httpOnly: true,
        },
        {
          url: "https://www.facebook.com/",
          domain: ".facebook.com",
          path: "/",
          name: "xs",
          value: "new-session",
          secure: true,
          httpOnly: true,
        },
      ],
      async () => false,
    ),
  );
  assert.equal(values.get("c_user"), "old-user");
  assert.equal(values.get("xs"), "old-session");
});

for (const phase of ["existing session at commit"]) {
  test(`protected import preserves ${phase} destination before any writes`, async () => {
    const existing = [
      cookie("c_user", "own-user"),
      cookie("xs", "own-session"),
    ];
    let writes = 0;
    const jar = {
      get: async () => existing,
      set: async () => {
        writes++;
      },
      remove: async () => {
        writes++;
      },
      flushStore: async () => {},
    };
    await assert.rejects(
      replaceLoginCookies(
        jar,
        [cookie("c_user", "source-user"), cookie("xs", "source-session")],
        undefined,
        true,
      ),
      /destination-has-session/,
    );
    assert.equal(writes, 0);
    assert.deepEqual(
      existing.map((c) => c.value),
      ["own-user", "own-session"],
    );
  });
}
