import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { pageSnapshotScript } from "../src/main/page-snapshot.ts";

function telegramPage(html: string) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  return {
    document,
    location: {
      href: "https://web.telegram.org/k/",
      hostname: "web.telegram.org",
      pathname: "/k/",
    },
    innerWidth: 1000,
    innerHeight: 700,
  };
}

test("one page probe returns only auth status, scoped unread counters and sampled colors", () => {
  const context = telegramPage(
    '<div class="chatlist-chat">Private conversation</div><div role="tab">Unread<span class="badge">20</span></div>',
  );
  context.document.elementFromPoint = () => context.document.body;
  const snapshot = runInNewContext(pageSnapshotScript(true), {
    ...context,
    getComputedStyle: () => ({ backgroundColor: "rgb(24, 25, 26)" }),
  });
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    status: "authenticated",
    unread: { global: "20", loaded: null, kind: "conversations" },
    theme: "rgb(24, 25, 26)",
  });
});

test("login pages do not scan unread counters", () => {
  const context = telegramPage('<div class="auth-pages"></div>');
  let unreadQueries = 0;
  const querySelectorAll = context.document.querySelectorAll.bind(
    context.document,
  );
  context.document.querySelectorAll = (selector: string) => {
    if (selector.includes("tab")) unreadQueries++;
    return querySelectorAll(selector);
  };
  const snapshot = runInNewContext(pageSnapshotScript(false), context);
  assert.equal(snapshot.status, "needs-login");
  assert.equal(snapshot.unread, null);
  assert.equal(unreadQueries, 0);
});

test("inactive theme sampling performs no computed-style or hit-test reads", () => {
  const context = telegramPage('<div class="chatlist-chat"></div>');
  let styleReads = 0;
  let hitTests = 0;
  context.document.elementFromPoint = () => {
    hitTests++;
    return context.document.body;
  };
  const snapshot = runInNewContext(pageSnapshotScript(false), {
    ...context,
    getComputedStyle: () => {
      styleReads++;
      return { backgroundColor: "rgb(24, 25, 26)" };
    },
  });
  assert.equal(snapshot.status, "authenticated");
  assert.equal(snapshot.theme, null);
  assert.equal(styleReads, 0);
  assert.equal(hitTests, 0);
});

test("a failed theme sample preserves authentication and unread results", () => {
  const context = telegramPage(
    '<div class="chatlist-chat"></div><div role="tab">Unread<span class="badge">7</span></div>',
  );
  context.document.elementFromPoint = () => context.document.body;
  const snapshot = runInNewContext(pageSnapshotScript(true), {
    ...context,
    getComputedStyle: () => {
      throw new Error("page changed during sampling");
    },
  });
  assert.equal(snapshot.status, "authenticated");
  assert.equal(snapshot.unread.global, "7");
  assert.equal(snapshot.theme, null);
});
