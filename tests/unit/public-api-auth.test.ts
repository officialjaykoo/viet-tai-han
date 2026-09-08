import { describe, expect, it, vi } from "vitest";

const { getDb, sha256Hex, clientIpFromHeaders, AuthError } = vi.hoisted(() => {
  class TestAuthError extends Error {
    status: number;

    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  }

  return {
    getDb: vi.fn(),
    sha256Hex: vi.fn(),
    clientIpFromHeaders: vi.fn(),
    AuthError: TestAuthError,
  };
});

vi.mock("@/lib/db", () => ({ getDb }));
vi.mock("@/lib/security/challenge", () => ({ clientIpFromHeaders }));
vi.mock("@/lib/security/crypto", () => ({ sha256Hex }));
vi.mock("@/lib/session", () => ({ AuthError }));

import { requirePublicApiKey } from "@/lib/public-api-auth";

function makeRequest(authorization?: string, cookie?: string) {
  return new Request("https://vth.kr/api/posts", {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
}

function setupDatabase(row: unknown) {
  const first = vi.fn().mockResolvedValue(row);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare };
  getDb.mockResolvedValue(db);
  return { db, prepare, bind, first, run };
}

describe("public API authentication contract", () => {
  it("requires a Bearer API key before opening D1", async () => {
    await expect(requirePublicApiKey(makeRequest())).rejects.toMatchObject({
      status: 401,
      message: "API key required",
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects short, unknown, and revoked API keys", async () => {
    await expect(
      requirePublicApiKey(makeRequest("Bearer short"))
    ).rejects.toMatchObject({ status: 401, message: "Invalid API key" });

    setupDatabase(null);
    sha256Hex.mockResolvedValue("unknown-hash");
    await expect(
      requirePublicApiKey(makeRequest("Bearer unknown-key-1234"))
    ).rejects.toMatchObject({ status: 401, message: "Invalid API key" });

    setupDatabase({
      id: "key-revoked",
      userId: "user-1",
      revokedAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(
      requirePublicApiKey(makeRequest("Bearer revoked-key-1234"))
    ).rejects.toMatchObject({ status: 401, message: "Invalid API key" });
  });

  it("accepts a valid key without a red_human cookie and records last use", async () => {
    const { prepare, bind, run } = setupDatabase({
      id: "key-1",
      userId: "user-1",
      revokedAt: null,
    });
    sha256Hex.mockResolvedValue("hash-1");
    clientIpFromHeaders.mockReturnValue("203.0.113.10");

    await expect(
      requirePublicApiKey(makeRequest("Bearer valid-api-key-1234"))
    ).resolves.toEqual({
      ip: "203.0.113.10",
      userId: "user-1",
      keyId: "key-1",
    });
    expect(sha256Hex).toHaveBeenCalledWith("valid-api-key-1234");
    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("last_used_at")
    );
    expect(bind).toHaveBeenLastCalledWith("key-1");
    expect(run).toHaveBeenCalledOnce();
  });
});
