import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultProviders } from "../src/main/providers.ts";
import {
  accountPartition,
  createAccount,
  defaultAccounts,
  validateCatalog,
} from "../src/main/accounts.ts";
import { navigationPolicy } from "../src/main/security.ts";
import { normalizeProviderTabs } from "../src/main/provider-tabs.ts";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { authScript } from "../src/main/auth-detection.ts";
import { unreadScript } from "../src/main/unread-snapshot.ts";
import { normalizeUnread } from "../src/main/unread.ts";
import {
  AUTH_COOKIE_NAMES,
  ChromeSources,
} from "../src/main/local-accounts.ts";

test("WhatsApp is a built-in available after all existing providers", () => {
  const providers = defaultProviders();
  assert.deepEqual(
    providers.map((provider) => provider.id),
    [
      "zalo",
      "telegram",
      "messenger",
      "gmail",
      "instagram",
      "discord",
      "slack",
      "tinder",
      "whatsapp",
    ],
  );
  assert.deepEqual(providers.at(-1), {
    id: "whatsapp",
    label: "WhatsApp",
    entry: "https://web.whatsapp.com/",
    hosts: ["web.whatsapp.com"],
    color: "#25D366",
    custom: false,
  });
});

test("WhatsApp trusts only its exact HTTPS navigation host", () => {
  assert.equal(
    navigationPolicy("whatsapp", "https://web.whatsapp.com/"),
    "internal",
  );
  for (const url of [
    "http://web.whatsapp.com/",
    "https://web.whatsapp.com.evil.test/",
    "https://evil.web.whatsapp.com/",
    "https://www.whatsapp.com/",
    "https://www.facebook.com/",
  ])
    assert.equal(navigationPolicy("whatsapp", url), "external", url);
  for (const url of [
    "https://user:password@web.whatsapp.com/",
    "https://web.whatsapp.com:8443/",
    "file:///tmp/whatsapp",
  ])
    assert.equal(navigationPolicy("whatsapp", url), "blocked", url);
});

test("old catalogs gain WhatsApp without moving old sessions or saved tabs", () => {
  const legacy = defaultAccounts().filter(
    (account) => account.provider !== "whatsapp",
  );
  const before = legacy.map(accountPartition);
  const restored = validateCatalog({ version: 1, accounts: legacy });
  assert.deepEqual(
    restored
      .filter((account) => account.provider !== "whatsapp")
      .map(accountPartition),
    before,
  );
  const primary = restored.find((account) => account.provider === "whatsapp");
  assert.ok(primary);
  assert.equal(accountPartition(primary), "persist:whatsapp");
  const second = createAccount(
    "whatsapp",
    "Công việc",
    "CV",
    "12345678-1234-4234-8234-123456789abc",
  );
  assert.equal(
    accountPartition(second),
    "persist:tn-account-acc_12345678-1234-4234-8234-123456789abc",
  );
  const tabs = { open: ["tinder", "zalo"], pinned: ["zalo"] };
  assert.deepEqual(
    normalizeProviderTabs(
      tabs,
      defaultProviders().map((provider) => provider.id),
    ),
    tabs,
  );
});

test("WhatsApp Chrome import is rejected before accessing a Chrome profile", async () => {
  assert.deepEqual(AUTH_COOKIE_NAMES.whatsapp, []);
  await assert.rejects(
    new ChromeSources("/does-not-exist").read("Default", "whatsapp"),
    (error: unknown) =>
      (error as { code?: string }).code === "unsupported-session",
  );
});

test("maximum-size legacy catalogs remain writable after adding WhatsApp", () => {
  const legacy = defaultAccounts().filter(
    (account) => account.provider !== "whatsapp",
  );
  for (let index = legacy.length; index < 104; index++) {
    legacy.push(createAccount("telegram", `Fixture ${index}`));
  }
  const restored = validateCatalog({ version: 1, accounts: legacy });
  assert.equal(restored.length, 105);
  const renamed = restored.map((account) =>
    account.id === "whatsapp" ? { ...account, name: "Đã đổi tên" } : account,
  );
  assert.deepEqual(
    validateCatalog({ version: 2, providers: [], accounts: renamed }),
    renamed,
  );
});

test("built-in defaults never consume the legacy user-account capacity", () => {
  const additional = Array.from({ length: 104 }, (_, index) =>
    createAccount("telegram", `Fixture ${index}`),
  );
  const restored = validateCatalog({ version: 1, accounts: additional });
  assert.deepEqual(
    validateCatalog({ version: 2, providers: [], accounts: restored }),
    restored,
  );
  assert.throws(
    () =>
      validateCatalog({
        version: 1,
        accounts: [...additional, createAccount("telegram", "Over limit")],
      }),
    /invalid-catalog/,
  );
});

function whatsappDocument(html: string, title = "WhatsApp") {
  const { document } = parseHTML(
    `<html><head><title>${title}</title></head><body>${html}</body></html>`,
  );
  Object.defineProperty(document.body, "innerText", {
    get() {
      throw Error("Collectors must not scan chat text");
    },
  });
  for (const node of document.querySelectorAll("*")) {
    Object.defineProperty(node, "getClientRects", {
      value: () => (node.closest("[hidden]") ? [] : [{}]),
    });
  }
  return document;
}
const signedIn =
  '<div id="side"><header><button>New chat</button></header><div id="pane-side"></div></div>';
const linking =
  '<canvas role="img" aria-label="Scan this QR code to link a device"></canvas>';
function collect(script: string, document: Document) {
  return runInNewContext(script, {
    document,
    location: { hostname: "web.whatsapp.com", pathname: "/" },
  });
}

test("WhatsApp device linking takes priority over a stale signed-in shell", () => {
  assert.equal(collect(authScript, whatsappDocument(linking)), "needs-login");
  assert.equal(
    collect(authScript, whatsappDocument(signedIn + linking)),
    "needs-login",
  );
  assert.equal(
    collect(
      authScript,
      whatsappDocument("<button>Log in with QR code</button>"),
    ),
    "needs-login",
  );
});

test("WhatsApp signed-in controls support an empty inbox without scanning tutorial text", () => {
  assert.equal(
    collect(
      authScript,
      whatsappDocument(
        signedIn + "<main>Scan this QR code to link a device</main>",
      ),
    ),
    "authenticated",
  );
  assert.equal(
    collect(
      authScript,
      whatsappDocument(signedIn + `<div hidden>${linking}</div>`),
    ),
    "authenticated",
  );
});

test("WhatsApp loading, hidden controls and incomplete shells remain unverified", () => {
  for (const html of [
    '<div role="progressbar"></div>',
    '<div id="wa_web_initial_startup"></div>',
    `<div hidden>${signedIn}</div>`,
    '<div id="side"></div>',
    '<div id="pane-side"></div>',
    '<div role="alert">Could not connect</div>',
  ])
    assert.equal(collect(authScript, whatsappDocument(html)), "ready", html);
});

test("WhatsApp unread counts use only its exact title counter and require signed-in controls", () => {
  for (const [title, expected] of [
    ["(12) WhatsApp", 12],
    ["(1,234) WhatsApp", 1234],
    ["(99+) WhatsApp", 99],
    ["(0) WhatsApp", 0],
  ] as const) {
    const sample = collect(unreadScript, whatsappDocument(signedIn, title));
    const info = normalizeUnread(sample);
    assert.equal(info.count, expected, title);
    assert.equal(info.kind, "conversations");
    assert.equal(info.approximate, title.includes("+"));
  }
  for (const title of [
    "WhatsApp",
    "(8) Messenger",
    "(8) WhatsApp chat",
    "(1.2K) WhatsApp",
    "(12345678901234567890) WhatsApp",
  ]) {
    const sample = collect(
      unreadScript,
      whatsappDocument(
        signedIn +
          '<div role="row"><span aria-label="Unread">0397834586</span></div><div role="tab">Unread 15</div>',
        title,
      ),
    );
    assert.equal(normalizeUnread(sample).count, null, title);
  }
  for (const html of [
    linking,
    signedIn + linking,
    `<div hidden>${signedIn}</div>`,
    "",
  ]) {
    assert.equal(
      normalizeUnread(
        collect(unreadScript, whatsappDocument(html, "(12) WhatsApp")),
      ).count,
      null,
      html,
    );
  }
});

test("WhatsApp import guidance always directs linking, including without Chrome profiles", async () => {
  const { sessionImportState } =
    await import("../src/renderer/session-import.ts");
  for (const hasProfiles of [true, false]) {
    const state = sessionImportState({
      target: { provider: "whatsapp", label: "WhatsApp · Công việc" },
      hasProfiles,
      importing: false,
      accountBusy: false,
    });
    assert.equal(state.disabled, true);
    assert.equal(
      state.hint,
      "Mở WhatsApp trong Gom và liên kết thiết bị trên điện thoại.",
    );
  }
  const normal = sessionImportState({
    target: { provider: "messenger", label: "Messenger · Cá nhân" },
    hasProfiles: true,
    importing: false,
    accountBusy: false,
  });
  assert.equal(normal.disabled, false);
  assert.match(normal.hint, /Messenger · Cá nhân/);
  assert.equal(
    sessionImportState({
      target: undefined,
      hasProfiles: true,
      importing: false,
      accountBusy: false,
    }).disabled,
    true,
  );
  for (const [importing, accountBusy, hasProfiles] of [
    [true, false, true],
    [false, true, true],
    [false, false, false],
  ]) {
    assert.equal(
      sessionImportState({
        target: { provider: "messenger", label: "Messenger" },
        hasProfiles,
        importing,
        accountBusy,
      }).disabled,
      true,
    );
  }
});
