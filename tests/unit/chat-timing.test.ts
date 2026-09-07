import { describe, expect, it } from "vitest";

import { formatChatServerTiming } from "@/lib/chat-timing";

describe("chat timing", () => {
  it("formats duration metrics for Server-Timing", () => {
    expect(
      formatChatServerTiming({
        authMs: 3.14159,
        authorizeMs: 12,
        d1ReadStatements: 1,
      })
    ).toBe("auth;dur=3.1, authorize;dur=12.0");
  });

  it("omits non-duration and non-finite values", () => {
    expect(
      formatChatServerTiming({
        totalMs: Number.NaN,
        dbWriteMs: -4,
        d1BatchRoundTrips: 1,
      })
    ).toBe("db-write;dur=0.0");
  });
});
