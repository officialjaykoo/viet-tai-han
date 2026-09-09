import type { ChatMessage } from "@/lib/types";

export type LocalDeliveryState = "sending" | "sent" | "failed";

export type LocalChatMessage = ChatMessage & {
  localDeliveryState?: LocalDeliveryState;
};

export function compareChatMessages(
  a: LocalChatMessage,
  b: LocalChatMessage
): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function mergeMessages(
  current: LocalChatMessage[],
  incoming: LocalChatMessage[]
): LocalChatMessage[] {
  const merged = [...current];
  const byId = new Map<string, number>();
  const byClientMessageId = new Map<string, number>();
  const indexMessage = (message: LocalChatMessage, index: number) => {
    byId.set(message.id, index);
    if (message.clientMessageId && message.isMine) {
      byClientMessageId.set(message.clientMessageId, index);
    }
  };
  merged.forEach(indexMessage);

  for (const message of incoming) {
    const existingIndex =
      byId.get(message.id) ??
      (message.isMine && message.clientMessageId
        ? byClientMessageId.get(message.clientMessageId)
        : undefined);
    const normalized: LocalChatMessage = {
      ...message,
      localDeliveryState: message.localDeliveryState ?? "sent",
    };
    if (existingIndex === undefined) {
      const nextIndex = merged.push(normalized) - 1;
      indexMessage(normalized, nextIndex);
      continue;
    }
    merged[existingIndex] = normalized;
    indexMessage(normalized, existingIndex);
  }
  return merged.sort(compareChatMessages);
}

export function updateLocalDeliveryState(
  messages: LocalChatMessage[],
  clientMessageId: string,
  localDeliveryState: LocalDeliveryState
): LocalChatMessage[] {
  return messages.map((message) => {
    if (
      !message.isMine ||
      message.clientMessageId !== clientMessageId ||
      (localDeliveryState === "failed" && !message.id.startsWith("local:"))
    ) {
      return message;
    }
    return { ...message, localDeliveryState };
  });
}
