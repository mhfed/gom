import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationKey, type ConversationRef } from "../src/chat/model.ts";

test("conversation identity separates accounts, topics and delimiter-containing IDs", () => {
  const refs: ConversationRef[] = [
    { accountId: "a", conversationId: "b:c" },
    { accountId: "a:b", conversationId: "c" },
    { accountId: "a", conversationId: "b", topicId: "c" },
    { accountId: "a", conversationId: "b" },
    { accountId: "other", conversationId: "b" },
    { accountId: "a", conversationId: "b", topicId: "null" },
    { accountId: "a", conversationId: "b", topicId: "0" },
    { accountId: '["a","b"]', conversationId: "c" },
  ];
  assert.equal(new Set(refs.map(conversationKey)).size, refs.length);
  assert.equal(
    conversationKey({ accountId: "a", conversationId: "b" }),
    conversationKey({
      conversationId: "b",
      accountId: "a",
      topicId: undefined,
    }),
  );
});

test("identity rejects absent, non-string, empty, padded, control and oversized IDs", () => {
  const invalid = [
    undefined,
    null,
    12,
    {},
    [],
    "",
    " ",
    " a",
    "a ",
    "a\n",
    "a\0b",
    "x".repeat(1025),
  ];
  for (const value of invalid) {
    for (const field of ["accountId", "conversationId", "topicId"]) {
      if (field === "topicId" && value === undefined) continue;
      assert.throws(() =>
        conversationKey({
          accountId: "a",
          conversationId: "b",
          [field]: value,
        } as ConversationRef),
      );
    }
  }
  for (const value of [null, [], "a", undefined])
    assert.throws(() => conversationKey(value as unknown as ConversationRef));
});

test("provider identifiers remain opaque instead of being normalized or interpreted as paths", () => {
  const a = { accountId: "account", conversationId: "é/../thread?x=1" };
  const b = { accountId: "account", conversationId: "e\u0301/../thread?x=1" };
  assert.notEqual(conversationKey(a), conversationKey(b));
  assert.notEqual(
    conversationKey(a),
    conversationKey({ ...a, conversationId: "É/../thread?x=1" }),
  );
});
