export const LOCALES = ["vi", "ko", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const PREFERRED_LANGUAGES = ["unknown", ...LOCALES] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

export const LANG_COOKIE = "vth_lang";
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (LOCALES as readonly string[]).includes(value)
  );
}

export function isPreferredLanguage(
  value: unknown
): value is PreferredLanguage {
  return value === "unknown" || isLocale(value);
}

export function detectLocaleFromAcceptLanguage(
  header: string | null | undefined
): Locale | null {
  if (!header) return null;

  const candidates: {
    locale: Locale;
    quality: number;
    order: number;
  }[] = [];

  for (const [order, part] of header.split(",").entries()) {
    const [rawTag, ...parameters] = part.trim().split(";");
    const tag = rawTag?.trim().toLowerCase();
    if (!tag || tag === "*") continue;

    let quality = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.trim().split("=");
      if (name?.toLowerCase() !== "q") continue;
      const parsed = Number(value);
      quality =
        Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1) : 0;
    }
    if (quality === 0) continue;

    const baseLanguage = tag.split("-")[0];
    if (isLocale(baseLanguage)) {
      candidates.push({ locale: baseLanguage, quality, order });
    }
  }

  candidates.sort(
    (left, right) =>
      right.quality - left.quality || left.order - right.order
  );
  return candidates[0]?.locale ?? null;
}

export function detectLocaleFromCountry(
  countryCode: string | null | undefined
): Locale | null {
  switch (countryCode?.trim().toUpperCase()) {
    case "VN":
      return "vi";
    case "KR":
      return "ko";
    case "RU":
      return "ru";
    default:
      return null;
  }
}

/** Resolve explicit choice, account preference, browser, then Cloudflare country. */
export function resolveLocale(input: {
  preferredLanguage?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  countryCode?: string | null;
}): Locale {
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  if (isLocale(input.preferredLanguage)) return input.preferredLanguage;
  return (
    detectLocaleFromAcceptLanguage(input.acceptLanguage) ??
    detectLocaleFromCountry(input.countryCode) ??
    DEFAULT_LOCALE
  );
}
