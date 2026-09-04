import { describe, expect, it } from "vitest";

import { formatListingPrice } from "@/lib/marketplace";

describe("marketplace price formatting", () => {
  it("groups numeric price runs without changing surrounding text", () => {
    expect(formatListingPrice("50000 KRW")).toBe("50,000 KRW");
    expect(formatListingPrice("₩1000000")).toBe("₩1,000,000");
    expect(formatListingPrice("10000–25000원")).toBe("10,000–25,000원");
    expect(formatListingPrice("1,000원")).toBe("1,000원");
  });

  it("keeps negotiable and empty prices distinct", () => {
    expect(formatListingPrice("협의")).toBe("협의");
    expect(formatListingPrice("  ")).toBeNull();
    expect(formatListingPrice(null)).toBeNull();
  });
});
