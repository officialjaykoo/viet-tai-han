import { describe, expect, it } from "vitest";

import { verifyTurnstileToken } from "@/lib/security/turnstile";

describe("verifyTurnstileToken", () => {
  it("passes under E2E bot bypass", async () => {
    const prev = process.env.E2E_BOT_BYPASS;
    process.env.E2E_BOT_BYPASS = "1";
    try {
      expect(await verifyTurnstileToken(null)).toEqual({ ok: true });
      expect(await verifyTurnstileToken("")).toEqual({ ok: true });
    } finally {
      if (prev === undefined) delete process.env.E2E_BOT_BYPASS;
      else process.env.E2E_BOT_BYPASS = prev;
    }
  });

  it("rejects empty tokens when bypass is off", async () => {
    const prev = process.env.E2E_BOT_BYPASS;
    const prevPublic = process.env.NEXT_PUBLIC_E2E_BOT_BYPASS;
    delete process.env.E2E_BOT_BYPASS;
    delete process.env.NEXT_PUBLIC_E2E_BOT_BYPASS;
    try {
      expect((await verifyTurnstileToken(null)).ok).toBe(false);
      expect((await verifyTurnstileToken("")).ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.E2E_BOT_BYPASS;
      else process.env.E2E_BOT_BYPASS = prev;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_E2E_BOT_BYPASS;
      else process.env.NEXT_PUBLIC_E2E_BOT_BYPASS = prevPublic;
    }
  });
});
