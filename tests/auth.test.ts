import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { authScript } from "../src/main/auth-detection.ts";
test("Telegram K QR heading is classified as requiring login, not ready", () => {
  const result = runInNewContext(authScript, {
    location: {
      href: "https://web.telegram.org/k/",
      hostname: "web.telegram.org",
      pathname: "/k/",
    },
    document: {
      body: {
        innerText: "Log in by QR Code\nScan with Telegram app on your phone",
      },
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  });
  assert.equal(result, "needs-login");
});

test("authenticated Zalo chat controls take precedence over QR tutorial text in the chat page", () => {
  const result = runInNewContext(authScript, {
    location: {
      href: "https://chat.zalo.me/",
      hostname: "chat.zalo.me",
      pathname: "/",
    },
    document: {
      body: { innerText: "Quét mã QR để kết nối Zalo PC" },
      querySelector: (selector: string) =>
        selector.startsWith("#contact-search-input")
          ? { getClientRects: () => [{}] }
          : null,
      querySelectorAll: () => [],
    },
  });
  assert.equal(result, "authenticated");
});
