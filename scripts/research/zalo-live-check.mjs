// One-shot summary read, attaching to an explicitly supplied loopback CDP port.
// The user starts the endpoint separately; neither diagnostic harness owns it.
// No navigation, scrolling, focus changes, input, cookies, storage, or sending.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { probeZaloDom } from "./zalo-dom-probe.mjs";
import { readZaloVisibleInbox } from "../../src/main/chat/zalo-dom.ts";
import { connectLocalTarget, listLocalTargets } from "./local-cdp.mjs";

const port = process.argv[2];
const targets = await listLocalTargets(port);
const candidates = targets.filter((target) => {
  try {
    return (
      target.type === "page" &&
      new URL(target.url).origin === "https://chat.zalo.me"
    );
  } catch {
    return false;
  }
});
assert.equal(
  candidates.length,
  1,
  "Requires exactly one Zalo page; will not guess between accounts",
);
const connection = await connectLocalTarget(candidates[0], port);
const request = (method, params) => connection.request(method, params);

try {
  const { frameTree } = await request("Page.getFrameTree");
  const { executionContextId } = await request("Page.createIsolatedWorld", {
    frameId: frameTree.frame.id,
    worldName: "tin-nhan-readonly-zalo-research",
    grantUniveralAccess: false,
  });
  const expression = `(() => {
    const started = performance.now();
    const read = (${readZaloVisibleInbox.toString()});
    const first = read();
    const second = read();
    const structure = (${probeZaloDom.toString()})();
    return {
      status: first.status,
      coverage: first.coverage,
      loadedConversations: first.conversations.length,
      selectedConversations: first.conversations.filter(c => c.selected).length,
      namedConversations: first.conversations.filter(c => c.title.length > 0).length,
      truncated: first.truncated,
      unchangedOnImmediateRepeat: JSON.stringify(first) === JSON.stringify(second),
      distinctIds: new Set(first.conversations.map(c => c.conversationId)).size === first.conversations.length,
      contentOrIdentityValuesReturned: false,
      structure,
      durationMs: Math.round((performance.now() - started) * 100) / 100
    };
  })()`;
  const response = await request("Runtime.evaluate", {
    expression,
    contextId: executionContextId,
    returnByValue: true,
  });
  assert.ok(!response.exceptionDetails, "Read-only probe failed in page");
  const evidence = {
    checkedAt: new Date().toISOString(),
    scope:
      "Single authenticated rendered window; no scrolling, navigation, history, send or reload verification",
    result: response.result.value,
  };
  const output = new URL(
    "../../outputs/zalo-live-evidence.json",
    import.meta.url,
  );
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
  assert.equal(evidence.result.status, "available");
  assert.equal(evidence.result.distinctIds, true);
  assert.equal(evidence.result.unchangedOnImmediateRepeat, true);
} finally {
  // Disconnect the diagnostic socket, leaving the user's app and webviews alive.
  connection.close();
}
