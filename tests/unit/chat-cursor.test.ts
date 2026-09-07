import { describe, expect, it } from "vitest";

import {
  InvalidChatCursorError,
  openChatCursorWithSecret,
  signChatCursorWithSecret,
} from "@/lib/security/chat-cursor";

const secret = new TextEncoder().encode("test-chat-cursor-secret");
const context = {
  roomId: "room_1",
  userId: "user_1",
  direction: "before" as const,
};

describe("signed chat cursor", () => {
  it("round-trips a valid tuple", async () => {
    const token = await signChatCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00.000", id: "message_1" },
      context
    );
    expect(token.startsWith("cc1.")).toBe(true);
    await expect(
      openChatCursorWithSecret(secret, token, context)
    ).resolves.toEqual({
      createdAt: "2026-01-01 12:00:00.000",
      id: "message_1",
    });
  });

  it("rejects tampered and context-mismatched cursors", async () => {
    const token = await signChatCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00.000", id: "message_1" },
      context
    );
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${(parts[2] ?? "") + "aa"}`;
    await expect(
      openChatCursorWithSecret(secret, tampered, context)
    ).rejects.toBeInstanceOf(InvalidChatCursorError);
    await expect(
      openChatCursorWithSecret(secret, token, {
        ...context,
        direction: "after",
      })
    ).rejects.toBeInstanceOf(InvalidChatCursorError);
  });

  it("rejects malformed positions before signing", async () => {
    await expect(
      signChatCursorWithSecret(
        secret,
        { createdAt: "not-a-date", id: "message_1" },
        context
      )
    ).rejects.toBeInstanceOf(InvalidChatCursorError);
    await expect(
      signChatCursorWithSecret(
        secret,
        { createdAt: "2026-01-01 12:00:00.000", id: "bad\nmessage" },
        context
      )
    ).rejects.toBeInstanceOf(InvalidChatCursorError);
  });

  it("rejects expired cursors", async () => {
    const now = 1_700_000_000_000;
    const token = await signChatCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00.000", id: "message_1" },
      context,
      60_000,
      now
    );
    await expect(
      openChatCursorWithSecret(secret, token, context, now + 120_000)
    ).rejects.toBeInstanceOf(InvalidChatCursorError);
  });

  it("returns null for an empty cursor", async () => {
    await expect(
      openChatCursorWithSecret(secret, null, context)
    ).resolves.toBeNull();
  });
});
