/** Provider IDs are opaque. An account is always part of conversation identity. */
export interface ConversationRef {
  accountId: string;
  conversationId: string;
  topicId?: string;
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/** A tuple encoding avoids delimiter collisions without normalizing provider IDs. */
export function conversationKey(ref: ConversationRef): string {
  if (!ref || typeof ref !== "object" || Array.isArray(ref))
    throw new TypeError("invalid-conversation-ref");
  const { accountId, conversationId, topicId } = ref;
  if (
    !validId(accountId) ||
    !validId(conversationId) ||
    (topicId !== undefined && !validId(topicId))
  )
    throw new TypeError("invalid-conversation-ref");
  return JSON.stringify([accountId, conversationId, topicId ?? null]);
}
