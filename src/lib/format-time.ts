import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { getMessages, translate } from "@/lib/i18n/translate";

/** Safari-safe parsing for SQLite datetime strings. */
export function parseSqliteDate(iso: string): number {
  const normalized = iso.includes("T")
    ? iso
    : iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z");
  return Date.parse(normalized);
}

/** Compact Reddit-style relative time (“4h ago” / “4 ч назад”). */
export function formatRelativeTime(
  iso: string,
  now = Date.now(),
  locale: Locale = "en"
): string {
  const then = parseSqliteDate(iso);
  if (Number.isNaN(then)) return iso;

  const messages = getMessages(locale);
  const t = (key: MessageKey, count: number) =>
    translate(messages, key, { count });

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return t("time.secondsAgo", seconds);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minutesAgo", minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.daysAgo", days);
  const months = Math.floor(days / 30);
  if (months < 12) return t("time.monthsAgo", months);
  return t("time.yearsAgo", Math.floor(days / 365));
}

/** Local calendar date for post/comment timestamps older than a month. */
export function formatAbsoluteDate(iso: string, locale: Locale = "en"): string {
  const then = parseSqliteDate(iso);
  if (Number.isNaN(then)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(then);
  } catch {
    return new Date(then).toISOString().slice(0, 10);
  }
}

/** @deprecated Prefer `formatCakeDayDate` from `@/lib/account-age`. */
export function formatCakeDay(iso: string, locale: Locale = "en"): string {
  const then = parseSqliteDate(iso);
  if (Number.isNaN(then)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(then);
  } catch {
    return new Date(then).toISOString().slice(0, 10);
  }
}
