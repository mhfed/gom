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

test("authenticated Telegram chatlist takes precedence over QR tutorial text in messages", () => {
  for (const text of [
    "Log in by QR Code",
    "Log in to Telegram",
    "Đăng nhập vào Telegram",
    "Scan this QR code",
  ]) {
    const result = runInNewContext(authScript, {
      location: {
        href: "https://web.telegram.org/k/",
        hostname: "web.telegram.org",
        pathname: "/k/",
      },
      document: {
        body: { innerText: `Chats\nA tutorial shared in chat: ${text}` },
        querySelector: (selector: string) =>
          selector ===
          ".chatlist .chatlist-chat,.chatlist a[data-peer-id],.chatlist-chat"
            ? {}
            : null,
        querySelectorAll: () => [],
      },
    });
    assert.equal(result, "authenticated", text);
  }
});

test("Telegram login form still requires login when a chatlist is present", () => {
  const result = runInNewContext(authScript, {
    location: {
      href: "https://web.telegram.org/k/",
      hostname: "web.telegram.org",
      pathname: "/k/",
    },
    document: {
      body: { innerText: "Log in by QR Code" },
      querySelector: (selector: string) =>
        selector === ".auth-pages,.auth-qr-form,.page-auth" ||
        selector ===
          ".chatlist .chatlist-chat,.chatlist a[data-peer-id],.chatlist-chat"
          ? {}
          : null,
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

test("recognized chat controls and Messenger never read the full body text", async () => {
  const { parseHTML } = await import("linkedom");
  const scenarios = [
    {
      hostname: "web.telegram.org",
      html: '<div class="chatlist"><a class="chatlist-chat"></a></div>',
      expected: "authenticated",
    },
    {
      hostname: "chat.zalo.me",
      html: '<input id="contact-search-input">',
      expected: "authenticated",
    },
    {
      hostname: "www.messenger.com",
      html: '<h1>Chats</h1><button aria-label="New message"></button>',
      expected: "authenticated",
    },
    { hostname: "www.facebook.com", html: "", expected: "ready" },
    {
      hostname: "web.telegram.org",
      html: '<div class="auth-pages"></div>',
      expected: "needs-login",
    },
  ];
  for (const { hostname, html, expected } of scenarios) {
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    let bodyReads = 0;
    Object.defineProperty(document.body, "innerText", {
      get() {
        bodyReads++;
        return "A chat contains instructions to Log in by QR Code";
      },
    });
    for (const element of document.querySelectorAll("*")) {
      Object.defineProperty(element, "getClientRects", { value: () => [{}] });
    }
    const status = runInNewContext(authScript, {
      document,
      location: { href: `https://${hostname}/`, hostname, pathname: "/" },
    });
    assert.equal(status, expected, hostname);
    assert.equal(bodyReads, 0, `${hostname}: ${html}`);
  }
});

test("unrecognized Telegram and Zalo pages retain the login text fallback", async () => {
  const { parseHTML } = await import("linkedom");
  for (const [hostname, text] of [
    ["web.telegram.org", "Log in by QR Code"],
    ["chat.zalo.me", "Quét mã QR để đăng nhập"],
  ]) {
    const { document } = parseHTML("<html><body></body></html>");
    let bodyReads = 0;
    Object.defineProperty(document.body, "innerText", {
      get() {
        bodyReads++;
        return text;
      },
    });
    assert.equal(
      runInNewContext(authScript, {
        document,
        location: { href: `https://${hostname}/`, hostname, pathname: "/" },
      }),
      "needs-login",
      hostname,
    );
    assert.equal(bodyReads, 1, hostname);
  }
});
