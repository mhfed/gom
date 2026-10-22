import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import {
  decodeChromeCookie,
  chromiumExpiry,
} from "../src/main/import-crypto.ts";
import {
  navigationPolicy,
  validProviderId,
  trustedShellRequest,
} from "../src/main/security.ts";
import { ViewRegistry, flushBeforeClose } from "../src/main/view-registry.ts";

// Break caught: accepting a sibling/lookalike origin or privileged URL as a service page.
test("navigation allows exact service origins, isolates other services, rejects privileged schemes", () => {
  assert.equal(
    navigationPolicy("zalo", "https://id.zalo.me/account?continue=x"),
    "internal",
  );
  assert.equal(
    navigationPolicy("messenger", "https://www.facebook.com/messages/"),
    "internal",
  );
  assert.equal(
    navigationPolicy("telegram", "https://web.telegram.org/k/"),
    "internal",
  );
  assert.equal(
    navigationPolicy("zalo", "https://id.zalo.me.attacker.test/"),
    "external",
  );
  assert.equal(
    navigationPolicy("zalo", "https://web.telegram.org/"),
    "external",
  );
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://a:b@www.facebook.com/",
    "https://www.facebook.com:8443/",
  ]) {
    assert.equal(navigationPolicy("messenger", url), "blocked");
  }
});
test("only the local shell main frame may invoke privileged IPC", () => {
  const shell = {},
    mainFrame = {},
    remote = {};
  assert.equal(trustedShellRequest(shell, mainFrame, shell, mainFrame), true);
  assert.equal(trustedShellRequest(remote, mainFrame, shell, mainFrame), false);
  assert.equal(trustedShellRequest(shell, remote, shell, mainFrame), false);
  assert.equal(validProviderId("../../session"), false);
  assert.equal(validProviderId("telegram"), true);
});

// Hand-derived plaintext fixture; changing host binding or CBC handling must fail these tests.
const key = Buffer.from("00112233445566778899aabbccddeeff", "hex");
function encryptedCookie(host: string, value: string) {
  const cipher = createCipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20));
  const plain = Buffer.concat([
    createHash("sha256").update(host).digest(),
    Buffer.from(value),
  ]);
  return Buffer.concat([
    Buffer.from("v10"),
    cipher.update(plain),
    cipher.final(),
  ]).toString("hex");
}
test("Chrome cookies are decrypted only with the matching host and supported format", () => {
  const encrypted = encryptedCookie(
    ".facebook.com",
    "synthetic-session-fixture",
  );
  assert.equal(
    decodeChromeCookie(
      { host: ".facebook.com", encrypted, plain: "" },
      key,
      24,
    ),
    "synthetic-session-fixture",
  );
  assert.throws(() =>
    decodeChromeCookie(
      { host: ".messenger.com", encrypted, plain: "" },
      key,
      24,
    ),
  );
  assert.throws(() =>
    decodeChromeCookie(
      { host: ".facebook.com", encrypted: "7632300000", plain: "" },
      key,
      24,
    ),
  );
});
test("Chromium expiration is converted to seconds without extending a session cookie", () => {
  assert.equal(chromiumExpiry(11644473600000000), 0);
  assert.equal(chromiumExpiry(0), undefined);
  assert.equal(chromiumExpiry(13348540800000000), 1704067200);
});
test("switching services preserves view identity and unsent state; views are created once", () => {
  let creations = 0;
  const registry = new ViewRegistry((id: string) => ({
    id,
    draft: "",
    created: ++creations,
  }));
  const zalo = registry.activate("zalo");
  zalo.draft = "unsent fixture";
  registry.activate("telegram");
  assert.equal(registry.activate("zalo"), zalo);
  assert.equal(registry.activate("zalo").draft, "unsent fixture");
  assert.equal(creations, 2);
  assert.deepEqual(registry.ids(), ["zalo", "telegram"]);
});
test("quit waits for all cookie writes and still flushes other partitions after a failure", async () => {
  const events: string[] = [];
  const flush = (id: string, fail = false) => ({
    flushStorageData() {
      events.push(id + ":dom");
    },
    cookies: {
      async flushStore() {
        await new Promise((r) => setTimeout(r, 5));
        events.push(id + ":cookies");
        if (fail) throw Error("fixture");
      },
    },
  });
  const result = await flushBeforeClose([
    flush("zalo", true),
    flush("messenger"),
    flush("telegram"),
  ]);
  assert.equal(events.length, 6);
  assert.equal(result, false);
  assert.ok(events.includes("telegram:cookies"));
});

test("closing waits for an active import transaction and refuses new work", async () => {
  const { OperationGate } = await import("../src/main/operation-gate.ts");
  const gate = new OperationGate();
  let finish!: () => void;
  let done = false;
  const active = gate.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const closing = gate.close().then(() => {
    done = true;
  });
  await Promise.resolve();
  assert.equal(done, false);
  assert.equal(
    gate.run(async () => true),
    undefined,
  );
  finish();
  await active;
  await closing;
  assert.equal(done, true);
});

test("Zalo QR confirmation may pass its observed first-party login redirect without opening that host for other providers", () => {
  assert.equal(navigationPolicy("zalo", "https://jr.zaloapp.com/"), "internal");
  assert.equal(
    navigationPolicy("zalo", "https://jr.chat.zalo.me/"),
    "internal",
  );
  assert.equal(
    navigationPolicy("messenger", "https://jr.zaloapp.com/"),
    "external",
  );
  assert.equal(
    navigationPolicy("zalo", "https://jr.zaloapp.com.evil.test/"),
    "external",
  );
});
