import { test } from "node:test";
import assert from "node:assert/strict";
import { providerBounds } from "../src/main/layout.ts";
import { normalizeUnread, badgeText } from "../src/main/unread.ts";
test("collapsed and expanded sidebar bounds preserve the full remote view height", () => {
  assert.deepEqual(providerBounds(1024, 720, false), {
    x: 208,
    y: 76,
    width: 816,
    height: 644,
  });
  assert.deepEqual(providerBounds(1024, 720, true), {
    x: 80,
    y: 76,
    width: 944,
    height: 644,
  });
  assert.deepEqual(providerBounds(40, 40, true), {
    x: 80,
    y: 76,
    width: 0,
    height: 0,
  });
});
test("platform totals take precedence; loaded counts are explicit lower bounds", () => {
  assert.deepEqual(
    normalizeUnread({ global: "20", loaded: 99, kind: "conversations" }),
    {
      count: 20,
      kind: "conversations",
      approximate: false,
      source: "platform",
    },
  );
  assert.deepEqual(
    normalizeUnread({ global: null, loaded: 7, kind: "conversations" }),
    { count: 7, kind: "conversations", approximate: true, source: "loaded" },
  );
  assert.equal(
    badgeText(
      normalizeUnread({ global: null, loaded: 7, kind: "conversations" }),
    ),
    "7+",
  );
  assert.equal(
    badgeText(normalizeUnread({ global: "120", loaded: 0, kind: "messages" })),
    "99+",
  );
});
test("missing, malformed or negative values cannot become a false zero badge", () => {
  for (const global of [null, "garbage", "-1", "1.2K", Infinity])
    assert.equal(
      normalizeUnread({ global, loaded: null, kind: "messages" }).count,
      null,
    );
  assert.equal(
    normalizeUnread({ global: "0", loaded: null, kind: "messages" }).count,
    0,
  );
  assert.equal(
    badgeText(normalizeUnread({ global: null, loaded: 0, kind: "messages" })),
    "—",
  );
});

test("collector reads only scoped counters, not phone numbers or arbitrary chat text", async () => {
  const { parseHTML } = await import("linkedom");
  const { runInNewContext } = await import("node:vm");
  const { unreadScript } = await import("../src/main/unread-snapshot.ts");
  const collect = (hostname: string, html: string) => {
    const { document } = parseHTML(
      `<html><head><title>Messenger | Facebook</title></head><body>${html}</body></html>`,
    );
    return JSON.parse(
      JSON.stringify(
        runInNewContext(unreadScript, { document, location: { hostname } }),
      ),
    );
  };
  assert.deepEqual(
    collect(
      "web.telegram.org",
      '<div role="tab">All<div class="badge">5</div></div><div role="tab">Unread<div class="badge">20</div></div><div class="dialog-subtitle-badge-unread">13500</div>',
    ),
    { global: "20", loaded: null, kind: "conversations" },
  );
  assert.equal(
    collect(
      "chat.zalo.me",
      '<div class="z-noti-badge-container"><i class="fa-Message_28_Filled"></i><span class="leftbar-unread-badge"><i class="z-noti-badge__content fa-5_Plus_24_Line"></i></span></div><div class="a-child">88</div>',
    ).global,
    "5+",
  );
  assert.equal(
    collect(
      "chat.zalo.me",
      '<div class="z-noti-badge-container"><i class="fa-Message_28_Filled"></i></div><div class="a-child">88</div>',
    ).global,
    "0",
  );
  assert.equal(
    collect(
      "www.facebook.com",
      '<div role="row">0397834586</div><button aria-label="Notifications, 8 unread">8</button>',
    ).global,
    null,
  );
  assert.equal(
    collect(
      "www.facebook.com",
      '<div role="row"><i data-testid="mwthreadlist-item-unread-dot"></i><i data-testid="mwthreadlist-item-unread-dot"></i></div>',
    ).loaded,
    1,
  );
});

test("unknown Zalo glyphs stay unknown and similarly named Telegram folders cannot replace Unread", async () => {
  const { parseHTML } = await import("linkedom");
  const { runInNewContext } = await import("node:vm");
  const { unreadScript } = await import("../src/main/unread-snapshot.ts");
  const collect = (hostname: string, html: string) => {
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    return runInNewContext(unreadScript, { document, location: { hostname } });
  };
  assert.equal(
    collect(
      "chat.zalo.me",
      '<div class="z-noti-badge-container"><i class="fa-Message_28_Filled"></i><span class="leftbar-unread-badge"><i class="z-noti-badge__content fa-new-counter"></i></span></div>',
    ).global,
    null,
  );
  assert.equal(
    collect(
      "web.telegram.org",
      '<div role="tab">Unread Work<div class="badge">9</div></div><div role="tab">Unread<div class="badge">20</div></div>',
    ).global,
    "20",
  );
});

test("background views keep a real viewport so responsive clients can render their counters", async () => {
  const { layoutViews } = await import("../src/main/layout.ts");
  const updates: { visible: boolean; bounds: unknown }[] = [];
  const views = ["zalo", "messenger", "telegram"].map(
    (id) =>
      [
        id,
        {
          setVisible(value: boolean) {
            updates.push({ visible: value, bounds: null });
          },
          setBounds(bounds: unknown) {
            updates[updates.length - 1].bounds = bounds;
          },
        },
      ] as const,
  );
  layoutViews(views, 1024, 720, true, "zalo", "service");
  assert.deepEqual(
    updates.map((x) => x.visible),
    [true, false, false],
  );
  assert.ok(
    updates.every(
      (x) =>
        JSON.stringify(x.bounds) ===
        JSON.stringify({ x: 80, y: 76, width: 944, height: 644 }),
    ),
  );
});
