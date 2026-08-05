"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/lib/auth-client";
import type { ThemePreference } from "@/lib/user-settings";

const THEME_COOKIE = "red_theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolved: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCookieTheme(): ThemePreference | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  if (value === "system" || value === "light" || value === "dark") return value;
  return null;
}

function writeCookieTheme(theme: ThemePreference) {
  const maxAge = 60 * 60 * 24 * 365 * 2;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${maxAge}; samesite=lax`;
}

function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyDomTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  initialTheme = "system",
  children,
}: {
  initialTheme?: ThemePreference;
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const sessionTheme = (session?.user as { theme?: string } | undefined)?.theme;
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const fromCookie = typeof document !== "undefined" ? readCookieTheme() : null;
    return fromCookie ?? initialTheme;
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolveTheme(theme)
  );

  useEffect(() => {
    if (
      sessionTheme === "system" ||
      sessionTheme === "light" ||
      sessionTheme === "dark"
    ) {
      setThemeState(sessionTheme);
      writeCookieTheme(sessionTheme);
    }
  }, [sessionTheme]);

  useEffect(() => {
    const next = resolveTheme(theme);
    setResolved(next);
    applyDomTheme(next);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyDomTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeCookieTheme(next);
    applyDomTheme(resolveTheme(next));
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system" as ThemePreference,
      resolved: "light" as const,
      setTheme: () => {},
    };
  }
  return ctx;
}

/** Inline script for FOUC prevention — call from layout as dangerouslySetInnerHTML. */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m?decodeURIComponent(m[1]):"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
