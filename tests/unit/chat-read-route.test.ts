import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  AuthError,
  mockMarkChatMessagesRead,
  mockReadApiJson,
  mockRequireSession,
} = vi.hoisted(() => {
  class TestAuthError extends Error {
    status: number;

    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  }

  return {
    AuthError: TestAuthError,
    mockMarkChatMessagesRead: vi.fn(),
    mockReadApiJson: vi.fn(),
    mockRequireSession: vi.fn(),
  };
});

vi.mock("@/lib/messages", () => ({
  markChatMessagesRead: mockMarkChatMessagesRead,
}));
vi.mock("@/lib/public-error", () => ({
  jsonLocalizedError: vi.fn(async (message: string, status: number) =>
    Response.json({ error: message }, { status })
  ),
}));
vi.mock("@/lib/security/guard", () => ({
  readApiJson: mockReadApiJson,
}));
vi.mock("@/lib/session", () => ({
  AuthError,
  jsonAuthError: vi.fn(async (error: InstanceType<typeof AuthError>) =>
    Response.json({ error: error.message }, { status: error.status })
  ),
  requireSession: mockRequireSession,
}));

import { POST } from "@/app/api/messages/[roomId]/read/route";

function request() {
  return new NextRequest("http://localhost/api/messages/room-1/read", {
    method: "POST",
  });
}

describe("chat read API payload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "viewer" } });
  });

  it.each([
    ["null", null],
    ["array", []],
    ["number", 42],
    ["string", "foo"],
    ["empty object", {}],
    ["numeric message ID", { messageId: 123 }],
    ["array message ID", { messageId: [] }],
  ])("returns 400 for %s", async (_label, payload) => {
    mockReadApiJson.mockResolvedValue(payload);

    const response = await POST(request(), {
      params: Promise.resolve({ roomId: "room-1" }),
    });

    expect(response.status).toBe(400);
    expect(mockMarkChatMessagesRead).not.toHaveBeenCalled();
  });

  it("returns the authoritative read tuple", async () => {
    mockReadApiJson.mockResolvedValue({ messageId: "message-3" });
    mockMarkChatMessagesRead.mockResolvedValue({
      roomId: "room-1",
      messageId: "message-3",
      readThrough: {
        messageId: "message-3",
        createdAt: "2026-08-14 12:00:00.000",
      },
      updated: true,
    });

    const response = await POST(request(), {
      params: Promise.resolve({ roomId: "room-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      roomId: "room-1",
      readThrough: {
        messageId: "message-3",
        createdAt: "2026-08-14 12:00:00.000",
      },
    });
    expect(mockMarkChatMessagesRead).toHaveBeenCalledWith({
      roomId: "room-1",
      userId: "viewer",
      messageId: "message-3",
    });
  });
});
