import { describe, expect, it } from "vitest";

import {
  evaluateAttestation,
  honeypotsFilled,
  type BotAttestation,
} from "@/lib/security/bot-signals";

function base(over: Partial<BotAttestation> = {}): BotAttestation {
  const t0 = Date.now() - 2_000;
  const ts = Date.now();
  return {
    v: 1,
    t0,
    ts,
    dwellMs: ts - t0,
    moves: 3,
    keys: 2,
    focuses: 1,
    scrolls: 0,
    trusted: true,
    webdriver: false,
    traps: {
      website: "",
      url: "",
      company: "",
      phone: "",
      fax: "",
      contact_email_2: "",
    },
    ...over,
  };
}

describe("bot attestation", () => {
  it("accepts a human-looking attestation", () => {
    expect(evaluateAttestation(base()).ok).toBe(true);
  });

  it("rejects filled honeypots", () => {
    expect(honeypotsFilled({ website: "https://spam.test" })).toBe(true);
    expect(
      evaluateAttestation(base({ traps: { website: "https://spam.test" } })).ok
    ).toBe(false);
  });

  it("rejects webdriver and fast submits", () => {
    expect(evaluateAttestation(base({ webdriver: true })).ok).toBe(false);
    expect(evaluateAttestation(base({ dwellMs: 100, t0: Date.now() - 100, ts: Date.now() })).ok).toBe(
      false
    );
  });

  it("accepts anything when E2E bot bypass is enabled", () => {
    const prev = process.env.E2E_BOT_BYPASS;
    process.env.E2E_BOT_BYPASS = "1";
    try {
      expect(evaluateAttestation(base({ webdriver: true, dwellMs: 0 })).ok).toBe(
        true
      );
      expect(evaluateAttestation(null).ok).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.E2E_BOT_BYPASS;
      else process.env.E2E_BOT_BYPASS = prev;
    }
  });
});
