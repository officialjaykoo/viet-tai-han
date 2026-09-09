import type { LocalChatMessage } from "@/lib/chat-message-state";

export type ChatRoomState = {
  id: string;
  lastMessageAt: string | null;
  lastMessageId: string | null;
  lastBody: string | null;
  unreadCount: number;
};

export type ChatReadBoundary = {
  messageId: string;
  createdAt: string;
};

export const CHAT_ROOM_SEEN_MESSAGE_LIMIT = 256;

type ChatRoomPreviewMessage = Pick<
  LocalChatMessage,
  "id" | "body" | "createdAt"
>;
type ChatRoomIncomingMessage = ChatRoomPreviewMessage &
  Pick<LocalChatMessage, "isMine">;

function compareMessagePosition(
  a: Pick<ChatRoomPreviewMessage, "id" | "createdAt">,
  b: Pick<ChatRoomPreviewMessage, "id" | "createdAt">
): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function isAtOrAfterRoomLatest<T extends ChatRoomState>(
  room: T,
  message: ChatRoomPreviewMessage
): boolean {
  if (!room.lastMessageAt) return true;
  return (
    compareMessagePosition(
      { createdAt: message.createdAt, id: message.id },
      { createdAt: room.lastMessageAt, id: room.lastMessageId ?? "" }
    ) >= 0
  );
}

function moveRoomToFront<T extends ChatRoomState>(
  rooms: T[],
  index: number,
  nextRoom: T
): T[] {
  if (index === 0) return [nextRoom, ...rooms.slice(1)];
  return [nextRoom, ...rooms.slice(0, index), ...rooms.slice(index + 1)];
}

export function rememberCanonicalMessageIds(
  seenMessageIds: ReadonlySet<string>,
  messageIds: readonly string[]
): Set<string> {
  const next = new Set(seenMessageIds);
  for (const messageId of messageIds) {
    if (messageId) next.add(messageId);
  }
  while (next.size > CHAT_ROOM_SEEN_MESSAGE_LIMIT) {
    const oldest = next.values().next().value;
    if (oldest === undefined) break;
    next.delete(oldest);
  }
  return next;
}

export function reconcileRoomLatestMessage<T extends ChatRoomState>(
  rooms: T[],
  roomId: string,
  message: ChatRoomPreviewMessage
): T[] {
  const index = rooms.findIndex((room) => room.id === roomId);
  if (index < 0) return rooms;
  const room = rooms[index];
  const sameMessage = room.lastMessageId === message.id;
  if (!sameMessage && !isAtOrAfterRoomLatest(room, message)) return rooms;

  const nextRoom = {
    ...room,
    lastBody: message.body,
    lastMessageAt: message.createdAt,
    lastMessageId: message.id,
  };
  if (
    room.lastBody === nextRoom.lastBody &&
    room.lastMessageAt === nextRoom.lastMessageAt &&
    room.lastMessageId === nextRoom.lastMessageId &&
    index === 0
  ) {
    return rooms;
  }
  return moveRoomToFront(rooms, index, nextRoom);
}

export function applyIncomingRoomMessage<T extends ChatRoomState>(
  rooms: T[],
  roomId: string,
  message: ChatRoomIncomingMessage,
  isNearBottom: boolean,
  seenMessageIds: ReadonlySet<string> = new Set()
): {
  rooms: T[];
  unreadDelta: number;
  duplicate: boolean;
  seenMessageIds: Set<string>;
} {
  const index = rooms.findIndex((room) => room.id === roomId);
  if (index < 0) {
    return {
      rooms,
      unreadDelta: 0,
      duplicate: true,
      seenMessageIds: new Set(seenMessageIds),
    };
  }

  const room = rooms[index];
  const duplicate = seenMessageIds.has(message.id);
  const nextSeenMessageIds = rememberCanonicalMessageIds(seenMessageIds, [
    message.id,
  ]);
  const sameMessage = room.lastMessageId === message.id;
  const updatePreview =
    sameMessage || isAtOrAfterRoomLatest(room, message);
  const unreadDelta =
    !duplicate && !message.isMine && !isNearBottom ? 1 : 0;
  const nextRoom = {
    ...room,
    ...(updatePreview
      ? {
          lastBody: message.body,
          lastMessageAt: message.createdAt,
          lastMessageId: message.id,
        }
      : {}),
    unreadCount: room.unreadCount + unreadDelta,
  };
  if (
    room.lastBody === nextRoom.lastBody &&
    room.lastMessageAt === nextRoom.lastMessageAt &&
    room.lastMessageId === nextRoom.lastMessageId &&
    room.unreadCount === nextRoom.unreadCount
  ) {
    return {
      rooms,
      unreadDelta: 0,
      duplicate,
      seenMessageIds: nextSeenMessageIds,
    };
  }

  const nextRooms = updatePreview
    ? moveRoomToFront(rooms, index, nextRoom)
    : rooms.map((item, itemIndex) => (itemIndex === index ? nextRoom : item));
  return {
    rooms: nextRooms,
    unreadDelta,
    duplicate,
    seenMessageIds: nextSeenMessageIds,
  };
}

export function reconcileChatRoomRead<T extends ChatRoomState>(
  rooms: T[],
  roomId: string,
  readThrough: ChatReadBoundary
): { rooms: T[]; acknowledged: boolean; clearedUnread: number } {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) {
    return { rooms, acknowledged: false, clearedUnread: 0 };
  }
  if (
    room.lastMessageAt &&
    compareMessagePosition(
      { createdAt: room.lastMessageAt, id: room.lastMessageId ?? "" },
      { createdAt: readThrough.createdAt, id: readThrough.messageId }
    ) > 0
  ) {
    return { rooms, acknowledged: true, clearedUnread: 0 };
  }

  const clearedUnread = room.unreadCount;
  if (clearedUnread === 0) {
    return { rooms, acknowledged: true, clearedUnread: 0 };
  }

  return {
    rooms: rooms.map((item) =>
      item.id === roomId ? { ...item, unreadCount: 0 } : item
    ),
    acknowledged: true,
    clearedUnread,
  };
}
