import { parseSqliteDate } from "@/lib/format-time";

/** Reddit `timechunks` — year = 365d, month = 30d (see r2 `_utils.pyx`). */
const SECOND = 1;
const MINUTE = 60;
const HOUR = 60 * 60;
const DAY = 60 * 60 * 24;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

const TIME_CHUNKS = [
  { seconds: YEAR, singular: "year", plural: "years" },
  { seconds: MONTH, singular: "month", plural: "months" },
  { seconds: DAY, singular: "day", plural: "days" },
  { seconds: HOUR, singular: "hour", plural: "hours" },
  { seconds: MINUTE, singular: "minute", plural: "minutes" },
  { seconds: SECOND, singular: "second", plural: "seconds" },
] as const;

export type AccountAgeParts = {
  /** Whole days since creation (`timedelta.days`). */
  days: number;
  /** Total elapsed seconds (clamped ≥ 0). */
  seconds: number;
  /** Largest Reddit timechunk count (e.g. 5 for “5 years”). */
  count: number;
  unit: (typeof TIME_CHUNKS)[number]["singular"] | "millisecond";
};

/**
 * Account age using Reddit's `timesince` / `timetext` rules.
 * Largest non-zero chunk only (year → month → day → …).
 */
export function getAccountAge(
  createdAt: string | null | undefined,
  now = Date.now()
): AccountAgeParts {
  if (!createdAt) {
    return { days: 0, seconds: 0, count: 0, unit: "second" };
  }
  const then = parseSqliteDate(createdAt);
  if (Number.isNaN(then)) {
    return { days: 0, seconds: 0, count: 0, unit: "second" };
  }

  const deltaMs = Math.max(0, now - then);
  const seconds = Math.floor(deltaMs / 1000);
  const days = Math.floor(seconds / DAY);

  for (const chunk of TIME_CHUNKS) {
    const count = Math.floor(seconds / chunk.seconds);
    if (count !== 0) {
      return { days, seconds, count, unit: chunk.singular };
    }
  }

  // Sub-second ages — Reddit falls back to milliseconds.
  if (deltaMs > 0) {
    return {
      days: 0,
      seconds: 0,
      count: Math.floor(deltaMs),
      unit: "millisecond",
    };
  }

  return { days: 0, seconds: 0, count: 0, unit: "second" };
}

/** Whole days of account age (Reddit `timedelta.days`). */
export function accountAgeDays(
  createdAt: string | null | undefined,
  now = Date.now()
): number {
  return getAccountAge(createdAt, now).days;
}

function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Reddit profile age label, e.g. `"5 years"`, `"3 months"`, `"12 days"`.
 * Matches `timesince` / `simplified_timesince(..., include_tense=False)`.
 * Pass `locale` (BCP 47) to localize via `Intl.NumberFormat` unit style.
 */
export function formatAccountAge(
  createdAt: string | null | undefined,
  now = Date.now(),
  locale = "en"
): string {
  const age = getAccountAge(createdAt, now);
  if (age.count === 0) {
    if (locale.startsWith("ko")) return "방금 전";
    if (locale.startsWith("vi")) return "vừa xong";
    return "just now";
  }

  const unit = age.unit === "millisecond" ? "millisecond" : age.unit;
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).format(age.count);
  } catch {
    if (age.unit === "millisecond") {
      if (locale.startsWith("ko")) return `${age.count}밀리초`;
      if (locale.startsWith("vi")) return `${age.count} mili giây`;
      return pluralize(age.count, "millisecond", "milliseconds");
    }
    const chunk = TIME_CHUNKS.find((c) => c.singular === age.unit);
    if (!chunk) return locale.startsWith("ko") ? "방금 전" : "vừa xong";
    if (locale.startsWith("ko")) {
      const units: Record<string, string> = {
        year: "년",
        month: "개월",
        day: "일",
        hour: "시간",
        minute: "분",
        second: "초",
      };
      return `${age.count}${units[chunk.singular] ?? ""}`;
    }
    if (locale.startsWith("vi")) {
      const units: Record<string, string> = {
        year: "năm",
        month: "tháng",
        day: "ngày",
        hour: "giờ",
        minute: "phút",
        second: "giây",
      };
      return `${age.count} ${units[chunk.singular] ?? ""}`.trim();
    }
    return pluralize(age.count, chunk.singular, chunk.plural);
  }
}

/**
 * Cake day calendar date from `created_utc`-style timestamps.
 * Always formatted in UTC so the day matches Reddit's stored creation day.
 */
export function formatCakeDayDate(
  createdAt: string | null | undefined,
  locale = "en"
): string {
  if (!createdAt) return "";
  const then = parseSqliteDate(createdAt);
  if (Number.isNaN(then)) return createdAt;
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(then);
  } catch {
    return new Date(then).toISOString().slice(0, 10);
  }
}

/**
 * True when “now” falls on the annual cake-day anniversary (UTC calendar date).
 * Feb 29 accounts celebrate on Feb 28 in non-leap years (common convention).
 */
export function isCakeDay(
  createdAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!createdAt) return false;
  const then = parseSqliteDate(createdAt);
  if (Number.isNaN(then)) return false;

  const created = new Date(then);
  const current = new Date(now);
  const cMonth = created.getUTCMonth();
  const cDate = created.getUTCDate();
  const nMonth = current.getUTCMonth();
  const nDate = current.getUTCDate();

  if (cMonth === 1 && cDate === 29) {
    const leap =
      (current.getUTCFullYear() % 4 === 0 &&
        current.getUTCFullYear() % 100 !== 0) ||
      current.getUTCFullYear() % 400 === 0;
    if (!leap) return nMonth === 1 && nDate === 28;
  }

  return cMonth === nMonth && cDate === nDate;
}
