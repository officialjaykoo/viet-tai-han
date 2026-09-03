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
  needsLanguagePrompt,
  resolveLocale,
  type Locale,
  type PreferredLanguage,
} from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { getMessages, translate } from "@/lib/i18n/translate";
import { apiFetch, apiJson } from "@/lib/api-client";

type I18nContextValue = {
  locale: Locale;
  preferredLanguage: PreferredLanguage;
  showPrompt: boolean;
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

    // Cookie is source of truth for display so SSR and client stay in sync.
    // Session preference only fills in when no cookie is set.
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
        } else {
          setPreferredLanguage(sessionPref);
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

    if (signedIn && sessionPref === "unknown") {
      setPreferredLanguage("unknown");
      setLocale(DEFAULT_LOCALE);
      return;
    }

    if (!signedIn) {
      setCookieLocale(null);
      setLocale(DEFAULT_LOCALE);
      setPreferredLanguage("unknown");
    }
  }, [sessionPref, signedIn, cookieLocale]);

  const showPrompt = needsLanguagePrompt({
    preferredLanguage: signedIn ? preferredLanguage : "unknown",
    cookieLocale,
    signedIn,
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = getMessages(locale).meta.title;
  }, [locale]);

  useEffect(() => {
    if (!showPrompt) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPrompt]);

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
      showPrompt,
      setLanguage,
      t,
    }),
    [locale, preferredLanguage, showPrompt, setLanguage, t]
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
      showPrompt: false,
      setLanguage: async () => {},
      t: (key: MessageKey, params?: Record<string, string | number>) =>
        translate(messages, key, params),
    };
  }
  return ctx;
}

export function useResolvedInitialLocale(
  preferredLanguage: PreferredLanguage,
  cookieLocale: string | null
): Locale {
  return resolveLocale({ preferredLanguage, cookieLocale });
}
