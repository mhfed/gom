/**
 * One-shot, structure-only probe for a user-authorized Zalo Web document.
 * Serialize with `(${probeZaloDom.toString()})()`; all helpers live inside it.
 * No text, draft, credential, URL, application state, network or DOM writes.
 * This is research tooling, not a production connector or authentication test.
 */
export function probeZaloDom() {
  const started = performance.now();
  const result = {
    schema: "tin-nhan.zalo-dom-structure.v1",
    publicAssetBuild: "1b2d86e9567f6be024ce",
    status: "unsupported-origin",
    scope: "rendered-dom-only",
    contentRead: false,
    identityValuesReturned: false,
    limits: { nodesPerRoot: 3000, conversations: 40, messages: 60 },
  };
  if (location.origin !== "https://chat.zalo.me") return result;

  // Stop scanning after a fixed number of elements; output never grows with history.
  function collect(root, selector, limit) {
    if (!root) return { nodes: [], scanned: 0, truncated: false };
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let current = root;
    let scanned = 0;
    while (current && scanned < result.limits.nodesPerRoot && nodes.length < limit) {
      scanned += 1;
      if (current.matches(selector)) nodes.push(current);
      current = walker.nextNode();
    }
    return { nodes, scanned, truncated: Boolean(current) };
  }

  function present(element) {
    // A nonzero box is only a layout check, not proof of being inside the viewport.
    return Boolean(element && element.getClientRects().length);
  }

  const list = document.querySelector('#conversationListId[data-id="div_TabMsg_ThrdChList"]');
  const messageView = document.getElementById("messageView");
  const messageScroll = document.getElementById("messageViewScroll");
  const composer = document.getElementById("chatInput");
  const rows = collect(list, ".conv-item", result.limits.conversations);
  const bubbles = collect(messageScroll || messageView, '[data-component="bubble-message"]', result.limits.messages);
  const conversationIds = new Set();
  const serverMessageIds = new Set();
  const clientMessageIds = new Set();
  let duplicateConversationIds = 0;
  let duplicateServerMessageIds = 0;
  let duplicateClientMessageIds = 0;

  result.status = list || messageView ? "candidate-chat-structure" : "no-chat-structure";
  result.roots = {
    conversationList: Boolean(list),
    messageView: Boolean(messageView),
    messageScroll: Boolean(messageScroll),
    composer: Boolean(composer),
  };
  result.conversations = rows.nodes.map((row) => {
    const wrapper = row.closest("[anim-data-id]");
    const identity = wrapper && list.contains(wrapper) ? wrapper.getAttribute("anim-data-id") : null;
    const hasIdentity = Boolean(identity && identity.length <= 256);
    if (hasIdentity) {
      if (conversationIds.has(identity)) duplicateConversationIds += 1;
      conversationIds.add(identity);
    }
    return {
      rendered: present(row),
      selected: row.classList.contains("selected"),
      hasConversationIdentity: hasIdentity,
      hasNameElement: Boolean(row.querySelector(".conv-item-title__name")),
      hasLegacyPreviewElement: Boolean(row.querySelector(".conv-message")),
      hasCurrentPreviewElement: Boolean(row.querySelector(".z-conv-message")),
      hasPreviewTimeElement: Boolean(row.querySelector(".preview-time")),
    };
  });
  result.messages = bubbles.nodes.map((bubble) => {
    const text = bubble.querySelector('[data-component="text-container"][id^="mtc-"]');
    const serverIdentity = text ? text.id.slice(4) : null;
    const clientIdentity = bubble.id.startsWith("bb_msg_id_") ? bubble.id.slice(10) : null;
    const hasServerIdentity = Boolean(serverIdentity && serverIdentity.length <= 256);
    const hasClientIdentity = Boolean(clientIdentity && clientIdentity.length <= 256);
    if (hasServerIdentity) {
      if (serverMessageIds.has(serverIdentity)) duplicateServerMessageIds += 1;
      serverMessageIds.add(serverIdentity);
    }
    if (hasClientIdentity) {
      if (clientMessageIds.has(clientIdentity)) duplicateClientMessageIds += 1;
      clientMessageIds.add(clientIdentity);
    }
    return {
      rendered: present(bubble),
      outgoingClassPresent: bubble.classList.contains("me"),
      hasServerMessageIdentity: hasServerIdentity,
      hasClientMessageIdentity: hasClientIdentity,
      hasTextElement: Boolean(bubble.querySelector('[data-component="message-text-content"]')),
      hasRichTextElement: Boolean(bubble.querySelector('[data-component="rtf-container"]')),
      hasTimeElement: Boolean(bubble.querySelector(".card-send-time__sendTime")),
    };
  });
  result.identityChecks = {
    selectedConversationCount: result.conversations.filter((row) => row.selected).length,
    duplicateConversationIds,
    duplicateServerMessageIds,
    duplicateClientMessageIds,
  };
  result.scan = {
    conversationNodesVisited: rows.scanned,
    messageNodesVisited: bubbles.scanned,
    conversationsTruncated: rows.truncated,
    messagesTruncated: bubbles.truncated,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
  return result;
}
