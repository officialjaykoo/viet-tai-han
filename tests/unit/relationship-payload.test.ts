import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  AuthError,
  mockGetDb,
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
    mockGetDb: vi.fn(),
    mockReadApiJson: vi.fn(),
    mockRequireSession: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/friends", () => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  cancelFriendRequestByUsers: vi.fn(),
  declineFriendRequest: vi.fn(),
  listFriends: vi.fn(),
  listIncomingFriendRequests: vi.fn(),
  listOutgoingFriendRequests: vi.fn(),
  removeFriend: vi.fn(),
  sendFriendRequest: vi.fn(),
}));
vi.mock("@/lib/messages", () => ({
  cancelChatRequest: vi.fn(),
  respondToChatRequest: vi.fn(),
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
vi.mock("@/lib/user-actions", () => ({
  blockUser: vi.fn(),
  followUser: vi.fn(),
  reportTarget: vi.fn(),
  unblockUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

import { POST as friendsPost } from "@/app/api/friends/route";
import { POST as chatRequestPost } from "@/app/api/messages/requests/[id]/route";
import { POST as userPost } from "@/app/api/users/[username]/route";

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "POST" });
}

describe("relationship API payload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "viewer" } });
    mockGetDb.mockResolvedValue({
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue({ id: "target" }),
        })),
      })),
    });
  });

  it.each([
    ["friends null body", friendsPost, "/api/friends", null, undefined],
    [
      "friends object requestId",
      friendsPost,
      "/api/friends",
      { action: "accept", requestId: {} },
      undefined,
    ],
    ["users array body", userPost, "/api/users/target", [], { params: Promise.resolve({ username: "target" }) }],
    [
      "users null reason",
      userPost,
      "/api/users/target",
      { action: "report", reason: null },
      { params: Promise.resolve({ username: "target" }) },
    ],
    [
      "users object details",
      userPost,
      "/api/users/target",
      { action: "report", reason: "spam", details: {} },
      { params: Promise.resolve({ username: "target" }) },
    ],
    [
      "chat request array action",
      chatRequestPost,
      "/api/messages/requests/request-1",
      { action: [] },
      { params: Promise.resolve({ id: "request-1" }) },
    ],
  ] as const)("returns 400 for %s", async (_label, handler, path, body, context) => {
    mockReadApiJson.mockResolvedValue(body);
    const response = await handler(
      request(path),
      context as never
    );
    expect(response.status).toBe(400);
  });
});
