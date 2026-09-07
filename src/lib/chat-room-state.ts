import type { LocalChatMessage } from "@/lib/chat-message-state";

export type ChatRoomState = {
  id: string;
  lastMessageAt: string | null;
  lastMessageId: string | null;
  lastBody: string | null;
  unreadCount: number;
};

type ChatRoomPreviewMessage = Pick<
  LocalChatMessage,
  "id" | "body" | "createdAt"
>;
type ChatRoomIncomingMessage = ChatRoomPreviewMessage &
  Pick<LocalChatMessage, "isMine">;

function isAtOrAfterRoomLatest<T extends ChatRoomState>(
  room: T,
  message: ChatRoomPreviewMessage
): boolean {
  if (!room.lastMessageAt) return true;
  if (message.createdAt > room.lastMessageAt) return true;
  if (message.createdAt < room.lastMessageAt) return false;
  return message.id >= (room.lastMessageId ?? "");
}

function moveRoomToFront<T extends ChatRoomState>(
  rooms: T[],
  index: number,
  nextRoom: T
): T[] {
  if (index === 0) return [nextRoom, ...rooms.slice(1)];
  return [nextRoom, ...rooms.slice(0, index), ...rooms.slice(index + 1)];
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
  isNearBottom: boolean
): { rooms: T[]; unreadDelta: number } {
  const index = rooms.findIndex((room) => room.id === roomId);
  if (index < 0) return { rooms, unreadDelta: 0 };
  const room = rooms[index];
  const sameMessage = room.lastMessageId === message.id;
  if (!sameMessage && !isAtOrAfterRoomLatest(room, message)) {
    return { rooms, unreadDelta: 0 };
  }

  const unreadDelta =
    !sameMessage && !message.isMine && !isNearBottom ? 1 : 0;
  const nextRoom = {
    ...room,
    lastBody: message.body,
    lastMessageAt: message.createdAt,
    lastMessageId: message.id,
    unreadCount: room.unreadCount + unreadDelta,
  };
  if (
    room.lastBody === nextRoom.lastBody &&
    room.lastMessageAt === nextRoom.lastMessageAt &&
    room.lastMessageId === nextRoom.lastMessageId &&
    room.unreadCount === nextRoom.unreadCount &&
    index === 0
  ) {
    return { rooms, unreadDelta: 0 };
  }
  return {
    rooms: moveRoomToFront(rooms, index, nextRoom),
    unreadDelta,
  };
}

export function reconcileChatRoomRead<T extends ChatRoomState>(
  rooms: T[],
  roomId: string,
  messageId: string
): { rooms: T[]; acknowledged: boolean; clearedUnread: number } {
  const room = rooms.find((item) => item.id === roomId);
  if (!room || room.lastMessageId !== messageId) {
    return { rooms, acknowledged: false, clearedUnread: 0 };
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
