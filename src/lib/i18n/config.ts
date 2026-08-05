export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const PREFERRED_LANGUAGES = ["unknown", "en", "ru"] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

export const LANG_COOKIE = "red_lang";
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ru";
}

export function isPreferredLanguage(value: unknown): value is PreferredLanguage {
  return value === "unknown" || value === "en" || value === "ru";
}

/** Resolve UI locale — cookie wins so SSR matches the client chooser. */
export function resolveLocale(input: {
  preferredLanguage?: string | null;
  cookieLocale?: string | null;
}): Locale {
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  if (isLocale(input.preferredLanguage)) return input.preferredLanguage;
  return DEFAULT_LOCALE;
}

export function needsLanguagePrompt(input: {
  preferredLanguage?: string | null;
  cookieLocale?: string | null;
  signedIn: boolean;
}): boolean {
  // Cookie counts as an answered choice (covers guests + stale session cache).
  if (isLocale(input.cookieLocale)) return false;
  if (input.signedIn) {
    const pref = input.preferredLanguage ?? "unknown";
    return pref === "unknown" || !isPreferredLanguage(pref);
  }
  return true;
}
