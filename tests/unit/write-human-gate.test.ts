import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  AuthError,
  createPost,
  getDb,
  getTunnelContext,
  jsonAuthError,
  mockOpenHumanToken,
  mockReadApiJson,
  mockRequireActiveUser,
  mockRequireBotAttestation,
  mockRequireSession,
  mockRequireSignedHeaders,
  mockUploadPostImage,
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
    createPost: vi.fn(),
    getDb: vi.fn(),
    getTunnelContext: vi.fn(),
    jsonAuthError: vi.fn(async (error: TestAuthError) =>
      Response.json({ error: error.message }, { status: error.status })
    ),
    mockOpenHumanToken: vi.fn(),
    mockReadApiJson: vi.fn(),
    mockRequireActiveUser: vi.fn(),
    mockRequireBotAttestation: vi.fn(),
    mockRequireSession: vi.fn(),
    mockRequireSignedHeaders: vi.fn(),
    mockUploadPostImage: vi.fn(),
  };
});

vi.mock("@/lib/actions", () => ({ createPost }));
vi.mock("@/lib/db", () => ({
  InvalidFeedCursorError: class InvalidFeedCursorError extends Error {},
  getDb,
  getFeedPosts: vi.fn(),
}));
vi.mock("@/lib/idempotency", () => ({
  requestIdFromHeaders: vi.fn(() => null),
}));
vi.mock("@/lib/media", () => ({
  uploadPostImage: mockUploadPostImage,
}));
vi.mock("@/lib/permissions", () => ({
  requireActiveUser: mockRequireActiveUser,
}));
vi.mock("@/lib/post-payload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/post-payload")>(
    "@/lib/post-payload"
  );
  return actual;
});
vi.mock("@/lib/public-error", () => ({
  jsonLocalizedError: vi.fn(async (message: string, status: number) =>
    Response.json({ error: message }, { status })
  ),
}));
vi.mock("@/lib/security/bot-guard", () => ({
  requireBotAttestation: mockRequireBotAttestation,
}));
vi.mock("@/lib/security/guard", () => ({
  readApiJson: mockReadApiJson,
  requireSignedHeaders: mockRequireSignedHeaders,
}));
vi.mock("@/lib/security/human-cookie", () => ({
  HUMAN_COOKIE: "red_human",
  openHumanToken: mockOpenHumanToken,
}));
vi.mock("@/lib/security/tunnel-context", () => ({
  getTunnelContext,
}));
vi.mock("@/lib/session", () => ({
  AuthError,
  getSession: vi.fn(),
  jsonAuthError,
  requireSession: mockRequireSession,
}));

import { POST as postPOST } from "@/app/api/posts/route";
import { POST as mediaPOST } from "@/app/api/media/route";

function postsRequest(cookie?: string, authorization?: string) {
  return new NextRequest("http://localhost/api/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body: "{}",
  });
}

function mediaRequest(cookie?: string, authorization?: string) {
  const form = new FormData();
  form.set("file", new File(["image"], "image.jpg", { type: "image/jpeg" }));
  return new NextRequest("http://localhost/api/media", {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body: form,
  });
}

function setTunnel(verified: boolean) {
  getTunnelContext.mockReturnValue(
    verified
      ? {
          verified: true,
          json: {
            subreddit: "general",
            title: "Valid post title",
          },
          raw: new Uint8Array([1]),
          ip: "127.0.0.1",
          contentType: "image/jpeg",
          filename: "image.jpg",
        }
      : null
  );
}

describe("browser human proof on canonical post and media writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTunnel(false);
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1", status: "active", username: "alice" },
    });
    mockRequireActiveUser.mockResolvedValue(undefined);
    mockReadApiJson.mockResolvedValue({
      subreddit: "general",
      title: "Valid post title",
    });
    mockRequireBotAttestation.mockImplementation((value: unknown) => value);
    mockRequireSignedHeaders.mockResolvedValue({ ip: "127.0.0.1" });
    mockOpenHumanToken.mockImplementation(async (value: string | null) =>
      value === "valid" ? value : null
    );
    createPost.mockResolvedValue({ id: "post-1" });
    mockUploadPostImage.mockResolvedValue({
      mediaKey: "media/image-1.jpg",
      contentType: "image/jpeg",
    });
    getDb.mockResolvedValue({
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue({
            id: "community-1",
            created_by: null,
          }),
        })),
      })),
    });
  });

  it("accepts a tunnel post with a valid human cookie", async () => {
    setTunnel(true);

    const response = await postPOST(postsRequest("red_human=valid"));

    expect(response.status).toBe(201);
    expect(createPost).toHaveBeenCalledOnce();
  });

  it("rejects a tunnel post when the human cookie is missing or invalid", async () => {
    setTunnel(true);

    const response = await postPOST(postsRequest());

    expect(response.status).toBe(403);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("does not require a human cookie after the direct API key guard", async () => {
    const response = await postPOST(
      postsRequest(undefined, "Bearer valid-api-key")
    );

    expect(response.status).toBe(201);
    expect(createPost).toHaveBeenCalledOnce();
  });

  it("still requires a Better Auth session after the direct API key guard", async () => {
    mockRequireSession.mockRejectedValueOnce(
      new AuthError("Unauthorized", 401)
    );
    const response = await postPOST(
      postsRequest(undefined, "Bearer valid-api-key")
    );

    expect(response.status).toBe(401);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("accepts a tunnel media upload with a valid human cookie", async () => {
    setTunnel(true);

    const response = await mediaPOST(mediaRequest("red_human=valid"));

    expect(response.status).toBe(201);
    expect(mockUploadPostImage).toHaveBeenCalledOnce();
  });

  it("rejects a tunnel media upload when the human cookie is missing", async () => {
    setTunnel(true);

    const response = await mediaPOST(mediaRequest());

    expect(response.status).toBe(403);
    expect(mockUploadPostImage).not.toHaveBeenCalled();
  });

  it("does not require a human cookie on direct public media uploads", async () => {
    const response = await mediaPOST(
      mediaRequest(undefined, "Bearer valid-api-key")
    );

    expect(response.status).toBe(201);
    expect(mockUploadPostImage).toHaveBeenCalledOnce();
  });
});
