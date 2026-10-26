import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { readZaloVisibleInbox } from "../src/main/chat/zalo-dom.ts";

// Synthetic content; structure comes from Zalo's public UI build documented in
// docs/zalo-web-connector-2026-10-26.md. These are not real account messages.
const row = (id: string, name: string, extra = "") => `
<div anim-data-id="${id}"><div class="conv-item ${extra}">
  <div class="conv-item-title__name">${name}</div>
  <div class="z-conv-message"><span>Nháp: </span><span class="z-conv-message__preview-message">Tiếng Việt chưa gửi</span></div>
</div></div>`;
function fixture(rows: string, origin = "https://chat.zalo.me") {
  const { document, NodeFilter } = parseHTML(`<html><body>
    <input id="contact-search-input"><div id="conversationListId" data-id="div_TabMsg_ThrdChList">${rows}</div>
    <div id="chatInput" contenteditable="true">Bản nháp riêng</div>
    <input type="hidden" value="private-token">
  </body></html>`);
  const run = () =>
    JSON.parse(
      JSON.stringify(
        runInNewContext(`(${readZaloVisibleInbox.toString()})()`, {
          document,
          location: { origin },
          NodeFilter,
        }),
      ),
    );
  return { document, run };
}

test("visible Zalo rows retain distinct IDs even for identical names and never label a draft as a sent message", () => {
  const { run } = fixture(
    row("101", "Cùng tên", "selected") + row("202", "Cùng tên"),
  );
  const result = run();
  assert.equal(result.status, "available");
  assert.equal(result.coverage, "rendered-window");
  assert.deepEqual(result.conversations, [
    {
      conversationId: "101",
      title: "Cùng tên",
      previewText: "Nháp: Tiếng Việt chưa gửi",
      selected: true,
    },
    {
      conversationId: "202",
      title: "Cùng tên",
      previewText: "Nháp: Tiếng Việt chưa gửi",
      selected: false,
    },
  ]);
});

test("static data-id markers are not conversation IDs and missing identities fail closed", () => {
  const { run } = fixture(
    '<div class="conv-item" data-id="div_TabMsg_ThrdChList"><span class="conv-item-title__name">Name</span></div>',
  );
  assert.equal(run().status, "ambiguous-identity");
  assert.deepEqual(run().conversations, []);
});

test("duplicate conversation identities and multiple selected rows fail closed", () => {
  assert.equal(
    fixture(row("101", "A") + row("101", "B")).run().status,
    "ambiguous-identity",
  );
  assert.equal(
    fixture(row("101", "A", "selected") + row("202", "B", "selected")).run()
      .status,
    "ambiguous-identity",
  );
});

test("snapshot does not include or modify composer, credentials or provider HTML", () => {
  const { document, run } = fixture(row("101", "&lt;img onerror=alert(1)&gt;"));
  const before = document.toString();
  const result = run();
  assert.equal(result.conversations[0].title, "<img onerror=alert(1)>");
  assert.ok(!JSON.stringify(result).includes("private-token"));
  assert.ok(!JSON.stringify(result).includes("Bản nháp riêng"));
  assert.equal(document.toString(), before);
});

test("unexpected origin, password or PIN overlays and unrecognized DOM cannot produce an inbox", () => {
  assert.equal(
    fixture(row("101", "A"), "https://chat.zalo.me.evil.test").run().status,
    "unsupported-dom",
  );
  const login = fixture(row("101", "A"));
  login.document.body.insertAdjacentHTML(
    "beforeend",
    '<input type="password">',
  );
  assert.equal(login.run().status, "blocked");
  const changed = fixture(row("101", "A"));
  changed.document
    .getElementById("conversationListId")!
    .removeAttribute("data-id");
  assert.equal(changed.run().status, "unsupported-dom");
});

test("known Zalo utility rows are never treated as conversation identities", () => {
  const special = ["stranger_box", "media_box", "-1000", "-2000", "g", "b", "n"]
    .map((id) => row(id, "Utility"))
    .join("");
  const mixed = fixture(special + row("101", "Actual conversation")).run();
  assert.deepEqual(
    mixed.conversations.map(
      (c: { conversationId: string }) => c.conversationId,
    ),
    ["101"],
  );
  const empty = fixture(special).run();
  assert.equal(empty.status, "unsupported-dom");
  assert.deepEqual(empty.conversations, []);
});

test("large rendered lists are bounded and explicitly truncated, never complete", () => {
  const { run } = fixture(
    Array.from({ length: 80 }, (_, i) => row(String(i + 1), "Name")).join(""),
  );
  const result = run();
  assert.equal(result.status, "available");
  assert.equal(result.conversations.length, 40);
  assert.equal(result.truncated, true);
  assert.equal(result.coverage, "rendered-window");
});

test("legacy previews remain plain text and an empty rendered list is unverified", () => {
  const { document, run } = fixture(row("101", "Name"));
  document.querySelector(".z-conv-message")!.className = "conv-message";
  assert.equal(run().conversations[0].previewText, "Nháp: Tiếng Việt chưa gửi");
  assert.equal(fixture("").run().status, "unsupported-dom");
});

test("identity outside the conversation list and control/whitespace IDs are rejected", () => {
  const outside = fixture(
    '<div class="conv-item"><span class="conv-item-title__name">Name</span></div>',
  );
  outside.document.body.setAttribute("anim-data-id", "outside");
  assert.equal(outside.run().status, "ambiguous-identity");
  for (const id of [" ", " 101", "101\n", "10\u00011"]) {
    const page = fixture(row("101", "Name"));
    page.document
      .querySelector("[anim-data-id]")!
      .setAttribute("anim-data-id", id);
    assert.equal(page.run().status, "ambiguous-identity");
  }
});

test("node budget stops a sparse oversized list before reaching later conversations", () => {
  const { run } = fixture(
    row("101", "First") +
      "<div></div>".repeat(3100) +
      row("202", "Not scanned"),
  );
  const result = run();
  assert.equal(result.status, "available");
  assert.deepEqual(
    result.conversations.map(
      (c: { conversationId: string }) => c.conversationId,
    ),
    ["101"],
  );
  assert.equal(result.truncated, true);
});
