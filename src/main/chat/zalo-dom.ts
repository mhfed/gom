export type ZaloVisibleConversation = {
  conversationId: string;
  title: string;
  // May include a provider draft; this is not a confirmed latest message.
  previewText: string;
  selected: boolean;
};
export type ZaloVisibleInbox = {
  status: "available" | "unsupported-dom" | "blocked" | "ambiguous-identity";
  coverage: "rendered-window";
  conversations: ZaloVisibleConversation[];
  truncated: boolean;
};

/** Read-only research adapter. Self-contained for execution in an isolated world.
 * Not wired into production, and not evidence of history/send support.
 */
export function readZaloVisibleInbox(): ZaloVisibleInbox {
  const result: ZaloVisibleInbox = {
    status: "unsupported-dom",
    coverage: "rendered-window",
    conversations: [],
    truncated: false,
  };
  if (location.origin !== "https://chat.zalo.me") return result;
  if (document.querySelector('input[type="password"]')) {
    // The web client also uses password fields for PIN/app-lock screens.
    result.status = "blocked";
    return result;
  }
  const list = document.querySelector(
    '#conversationListId[data-id="div_TabMsg_ThrdChList"]',
  );
  if (!list || !document.getElementById("contact-search-input")) return result;
  const walker = document.createTreeWalker(list, 1 /* SHOW_ELEMENT */);
  const identities = new Set<string>();
  // Utility rows use the conversation layout but are not message destinations.
  const utilityIds = new Set([
    "stranger_box",
    "media_box",
    "-1000",
    "-2000",
    "g",
    "b",
    "n",
  ]);
  let node = walker.nextNode();
  let visited = 0;
  let selected = 0;
  while (node && visited < 3000 && result.conversations.length < 40) {
    visited++;
    const row = node as Element;
    if (row.matches(".conv-item")) {
      const wrapper = row.closest("[anim-data-id]");
      const id =
        wrapper && list.contains(wrapper)
          ? wrapper.getAttribute("anim-data-id")
          : null;
      if (id && utilityIds.has(id)) {
        node = walker.nextNode();
        continue;
      }
      if (
        !id ||
        id.length > 256 ||
        id.trim() !== id ||
        /[\u0000-\u001f\u007f]/.test(id) ||
        identities.has(id)
      ) {
        result.status = "ambiguous-identity";
        result.conversations = [];
        return result;
      }
      const title = row
        .querySelector(".conv-item-title__name")
        ?.textContent?.trim();
      if (!title) {
        result.conversations = [];
        return result;
      }
      identities.add(id);
      const isSelected = row.classList.contains("selected");
      if (isSelected && ++selected > 1) {
        result.status = "ambiguous-identity";
        result.conversations = [];
        return result;
      }
      result.conversations.push({
        conversationId: id,
        title: title.slice(0, 200),
        previewText: (
          row.querySelector(".z-conv-message,.conv-message")?.textContent ?? ""
        )
          .trim()
          .slice(0, 1000),
        selected: isSelected,
      });
    }
    node = walker.nextNode();
  }
  result.truncated = !!node;
  // An empty/unrecognized window is not proof of an empty authenticated inbox.
  if (result.conversations.length) result.status = "available";
  return result;
}
