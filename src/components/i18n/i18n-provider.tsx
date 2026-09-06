"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/lib/auth-client";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  isLocale,
  type Locale,
  type PreferredLanguage,
} from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { getMessages, translate } from "@/lib/i18n/translate";
import { apiFetch } from "@/lib/api-client";

type I18nContextValue = {
  locale: Locale;
  preferredLanguage: PreferredLanguage;
  setLanguage: (locale: Locale) => Promise<void>;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readCookieLocale(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookieLocale(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365 * 2;
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function I18nProvider({
  initialLocale,
  initialPreferredLanguage,
  initialCookieLocale,
  children,
}: {
  initialLocale: Locale;
  initialPreferredLanguage: PreferredLanguage;
  initialCookieLocale: string | null;
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>(
    initialPreferredLanguage
  );
  const [cookieLocale, setCookieLocale] = useState<string | null>(
    initialCookieLocale
  );
  const syncedCookieRef = useRef(false);

  const sessionPref = (session?.user as { preferredLanguage?: string } | undefined)
    ?.preferredLanguage;
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    const fromCookie = readCookieLocale() ?? cookieLocale;

    // An explicit cookie wins so SSR and client navigation keep the selected language.
    if (isLocale(fromCookie)) {
      setCookieLocale(fromCookie);
      setLocale(fromCookie);
      if (isLocale(sessionPref)) {
        setPreferredLanguage(sessionPref);
        if (sessionPref !== fromCookie && !syncedCookieRef.current) {
          syncedCookieRef.current = true;
          void apiFetch("/api/me/language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredLanguage: fromCookie }),
          }).then(() => {
            setPreferredLanguage(fromCookie);
          });
        }
      } else if (signedIn && sessionPref === "unknown") {
        setPreferredLanguage("unknown");
        if (!syncedCookieRef.current) {
          syncedCookieRef.current = true;
          void apiFetch("/api/me/language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredLanguage: fromCookie }),
          }).then(() => {
            setPreferredLanguage(fromCookie);
          });
        }
      } else if (!signedIn) {
        setPreferredLanguage("unknown");
      }
      return;
    }

    if (isLocale(sessionPref)) {
      setPreferredLanguage(sessionPref);
      setLocale(sessionPref);
      writeCookieLocale(sessionPref);
      setCookieLocale(sessionPref);
      return;
    }

    // No explicit choice yet: retain the server-detected browser/IP locale.
    setLocale(initialLocale);
    setPreferredLanguage("unknown");
  }, [sessionPref, signedIn, cookieLocale, initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = getMessages(locale).meta.title;
  }, [locale]);

  const setLanguage = useCallback(
    async (next: Locale) => {
      writeCookieLocale(next);
      setCookieLocale(next);
      setLocale(next);
      setPreferredLanguage(next);

      if (signedIn) {
        try {
          await apiFetch("/api/me/language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredLanguage: next }),
          });
        } catch {
          // cookie still applied for UI
        }
      }
    },
    [signedIn]
  );

  const messages = getMessages(locale);
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      translate(messages, key, params),
    [messages]
  );

  const value = useMemo(
    () => ({
      locale,
      preferredLanguage,
      setLanguage,
      t,
    }),
    [locale, preferredLanguage, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const messages = getMessages(DEFAULT_LOCALE);
    return {
      locale: DEFAULT_LOCALE,
      preferredLanguage: "unknown" as PreferredLanguage,
      setLanguage: async () => {},
      t: (key: MessageKey, params?: Record<string, string | number>) =>
        translate(messages, key, params),
    };
  }
  return ctx;
}

