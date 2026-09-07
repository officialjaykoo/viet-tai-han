import { describe, expect, it, vi } from "vitest";

const { getEnv } = vi.hoisted(() => ({
  getEnv: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getEnv }));

import { broadcastChatMessage } from "@/lib/chat-realtime";

describe("chat realtime broadcast", () => {
  it("does not fail a committed send when the Durable Object is unavailable", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("DO unavailable"));
    getEnv.mockResolvedValue({
      BETTER_AUTH_SECRET: "test-secret",
      CHAT_ROOM: {
        idFromName: vi.fn(() => "room-test"),
        get: vi.fn(() => ({ fetch })),
      },
    });
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      broadcastChatMessage({
        roomId: "room-test",
        id: "message-test",
        clientMessageId: "client-test",
        body: "private message body",
        createdAt: "2026-08-14 12:00:00.000",
        senderId: "sender-test",
        senderUsername: "alice",
      })
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).not.toContain(
      "private message body"
    );
    error.mockRestore();
  });
});
