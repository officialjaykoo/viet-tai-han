import { describe, expect, it } from "vitest";

import {
  accountAgeDays,
  formatAccountAge,
  formatCakeDayDate,
  getAccountAge,
  isCakeDay,
} from "@/lib/account-age";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("account age (Reddit timesince)", () => {
  it("uses 365-day years and 30-day months", () => {
    const now = Date.parse("2026-08-05T12:00:00.000Z");

    expect(
      formatAccountAge("2025-08-05T12:00:00.000Z", now)
    ).toBe("1 year");
    expect(
      formatAccountAge("2024-08-05T12:00:00.000Z", now)
    ).toBe("2 years");
    // 40 days → 1 month (40 // 30), not “40 days”
    expect(
      formatAccountAge("2026-06-26T12:00:00.000Z", now)
    ).toBe("1 month");
    expect(
      formatAccountAge("2026-07-16T12:00:00.000Z", now)
    ).toBe("20 days");
    expect(
      formatAccountAge(new Date(now - 3 * HOUR).toISOString(), now)
    ).toBe("3 hours");
  });

  it("returns whole days like timedelta.days", () => {
    const now = Date.parse("2026-08-05T12:00:00.000Z");
    expect(accountAgeDays("2026-08-04T12:00:00.000Z", now)).toBe(1);
    expect(accountAgeDays("2025-08-05T12:00:00.000Z", now)).toBe(365);
    // Fractional day floors down
    expect(
      accountAgeDays(new Date(now - DAY * 1.9).toISOString(), now)
    ).toBe(1);
  });

  it("formats cake day in UTC", () => {
    expect(formatCakeDayDate("2020-01-15T23:30:00.000Z")).toBe(
      "January 15, 2020"
    );
  });

  it("detects cake day on the UTC anniversary", () => {
    const now = Date.parse("2026-03-10T18:00:00.000Z");
    expect(isCakeDay("2019-03-10T01:00:00.000Z", now)).toBe(true);
    expect(isCakeDay("2019-03-11T01:00:00.000Z", now)).toBe(false);
  });

  it("maps Feb 29 cake day to Feb 28 in non-leap years", () => {
    const nonLeap = Date.parse("2026-02-28T12:00:00.000Z");
    expect(isCakeDay("2020-02-29T12:00:00.000Z", nonLeap)).toBe(true);
    const leap = Date.parse("2024-02-29T12:00:00.000Z");
    expect(isCakeDay("2020-02-29T12:00:00.000Z", leap)).toBe(true);
    expect(isCakeDay("2020-02-29T12:00:00.000Z", Date.parse("2024-02-28T12:00:00.000Z"))).toBe(
      false
    );
  });

  it("exposes the largest chunk via getAccountAge", () => {
    const now = Date.parse("2026-08-05T00:00:00.000Z");
    // Exactly 3 * 365 days earlier (Reddit year chunk), ignoring leap days
    const created = new Date(now - 365 * 3 * DAY).toISOString();
    const age = getAccountAge(created, now);
    expect(age.count).toBe(3);
    expect(age.unit).toBe("year");
    expect(age.days).toBe(365 * 3);
  });
});
