import { describe, expect, it } from "vitest";

import {
  applyIncomingRoomMessage,
  reconcileChatRoomRead,
  reconcileRoomLatestMessage,
  type ChatRoomState,
} from "@/lib/chat-room-state";

type TestRoom = ChatRoomState & { label: string };

function room(overrides: Partial<TestRoom> = {}): TestRoom {
  return {
    id: "room-1",
    label: "room",
    lastMessageAt: "2026-08-14 12:00:00.000",
    lastMessageId: "message-3",
    lastBody: "latest",
    unreadCount: 3,
    ...overrides,
  };
}

function incoming(overrides: Partial<Parameters<typeof applyIncomingRoomMessage>[2]> = {}) {
  return {
    id: "message-4",
    body: "new message",
    createdAt: "2026-08-14 12:01:00.000",
    isMine: false,
    ...overrides,
  };
}

describe("chat room state", () => {
  it("reconciles the initial history latest message without adding unread", () => {
    const rooms = [
      room({
        lastMessageAt: "2026-08-14 11:59:00.000",
        lastMessageId: "message-2",
        lastBody: "stale",
        unreadCount: 3,
      }),
    ];

    const next = reconcileRoomLatestMessage(rooms, "room-1", incoming());

    expect(next[0]).toMatchObject({
      lastMessageId: "message-4",
      lastBody: "new message",
      unreadCount: 3,
    });
  });

  it("clears the room badge and returns its global unread delta", () => {
    const result = reconcileChatRoomRead([room()], "room-1", "message-3");

    expect(result).toMatchObject({ acknowledged: true, clearedUnread: 3 });
    expect(result.rooms[0]?.unreadCount).toBe(0);
  });

  it("clears a stale badge even when the server reports updated false", () => {
    const serverResult = { messageId: "message-3", updated: false };
    const result = reconcileChatRoomRead(
      [room()],
      "room-1",
      serverResult.messageId
    );

    expect(serverResult.updated).toBe(false);
    expect(result.acknowledged).toBe(true);
    expect(result.rooms[0]?.unreadCount).toBe(0);
  });

  it("does not clear an older read target after a newer live message arrives", () => {
    const live = applyIncomingRoomMessage(
      [room()],
      "room-1",
      incoming(),
      false
    );
    const read = reconcileChatRoomRead(live.rooms, "room-1", "message-3");

    expect(live.rooms[0]).toMatchObject({
      lastMessageId: "message-4",
      unreadCount: 4,
    });
    expect(read.acknowledged).toBe(false);
    expect(read.rooms[0]?.unreadCount).toBe(4);
  });

  it("increments unread while the user is scrolled away from the bottom", () => {
    const result = applyIncomingRoomMessage(
      [room({ unreadCount: 0 })],
      "room-1",
      incoming(),
      false
    );

    expect(result.unreadDelta).toBe(1);
    expect(result.rooms[0]?.unreadCount).toBe(1);
  });
});
