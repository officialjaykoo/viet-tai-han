export const LOCALES = ["vi", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const PREFERRED_LANGUAGES = ["unknown", "vi", "ko"] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

export const LANG_COOKIE = "vth_lang";
export const DEFAULT_LOCALE: Locale = "vi";

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "ko";
}

export function isPreferredLanguage(value: unknown): value is PreferredLanguage {
  return value === "unknown" || value === "vi" || value === "ko";
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
