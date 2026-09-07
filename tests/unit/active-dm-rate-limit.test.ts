import { describe, expect, it, vi } from "vitest";

const { getDb, getEnv, getSiteSetting } = vi.hoisted(() => ({
  getDb: vi.fn(),
  getEnv: vi.fn(),
  getSiteSetting: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb, getEnv }));
vi.mock("@/lib/settings", () => ({ getSiteSetting }));

import { enforceActiveDmRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";

describe("active DM rate limit", () => {
  it("uses the existing Workers binding without touching D1", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    getEnv.mockResolvedValue({ TUNNEL_IP_RATE_LIMITER: { limit } });

    await expect(enforceActiveDmRateLimit("user-1")).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledWith({ key: "dm:user:user-1" });
    expect(getDb).not.toHaveBeenCalled();
    expect(getSiteSetting).not.toHaveBeenCalled();
  });

  it("rejects only after the binding denies the user key", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    getEnv.mockResolvedValue({ TUNNEL_IP_RATE_LIMITER: { limit } });

    await expect(enforceActiveDmRateLimit("user-2")).rejects.toMatchObject(
      new AuthError("You're sending messages too quickly.", 429)
    );
    expect(getDb).not.toHaveBeenCalled();
  });
});
