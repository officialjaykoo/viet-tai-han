import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Manrope } from "next/font/google";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LanguagePrompt } from "@/components/i18n/language-prompt";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import {
  ThemeProvider,
  themeInitScript,
} from "@/components/theme/theme-provider";
import { isPreferredLanguage, type PreferredLanguage } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import type { ThemePreference } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestLocale();
  const messages = getMessages(locale);
  return {
    title: messages.meta.title,
    description: messages.meta.description,
    icons: {
      icon: "/icon.svg",
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
    appleWebApp: {
      capable: true,
      title: "Việt tại Hàn",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2622" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, preferredLanguage, cookieLocale, signedIn } =
    await getRequestLocale();
  const pref: PreferredLanguage = isPreferredLanguage(preferredLanguage)
    ? preferredLanguage
    : "unknown";

  const session = signedIn ? await getSession() : null;
  const themeRaw = (session?.user as { theme?: string } | undefined)?.theme;
  const initialTheme: ThemePreference =
    themeRaw === "light" || themeRaw === "dark" || themeRaw === "system"
      ? themeRaw
      : "system";

  return (
    <html
      lang={locale}
      className={cn("h-full antialiased", manrope.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="mobile-nav-space flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <ThemeProvider initialTheme={initialTheme}>
          <I18nProvider
            initialLocale={locale}
            initialPreferredLanguage={signedIn ? pref : "unknown"}
            initialCookieLocale={cookieLocale}
          >
            {children}
            <MobileNav />
            <SiteFooter />
            <LanguagePrompt />
            <ConsentBanner signedIn={signedIn} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
