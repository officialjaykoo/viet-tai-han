import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Geist_Mono, Manrope } from "next/font/google";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OnlinePresenceBeacon } from "@/components/online/online-presence-beacon";
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

async function isDeveloperHost(): Promise<boolean> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = (forwardedHost || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
  return host === "developers.vth.kr";
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isDeveloperHost()) {
    return {
      title: "VTH Developers",
      description: "Developer guide for the VTH social and community platform.",
      icons: {
        icon: "/icon.png",
        shortcut: "/icon.png",
        apple: "/icon.png",
      },
    };
  }

  const { locale } = await getRequestLocale();
  const messages = getMessages(locale);
  return {
    title: messages.meta.title,
    description: messages.meta.description,
    icons: {
      icon: "/icon.png",
      shortcut: "/icon.png",
      apple: "/icon.png",
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

function HtmlShell({
  children,
  lang,
  bodyClassName,
}: {
  children: ReactNode;
  lang: string;
  bodyClassName: string;
}) {
  return (
    <html
      lang={lang}
      className={cn("h-full antialiased", manrope.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={bodyClassName}>{children}</body>
    </html>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  if (await isDeveloperHost()) {
    return (
      <HtmlShell
        lang="en"
        bodyClassName="min-h-dvh bg-background font-sans text-foreground"
      >
        <ThemeProvider initialTheme="system">{children}</ThemeProvider>
      </HtmlShell>
    );
  }

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
  const { env } = await getCloudflareContext({ async: true });
  const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  return (
    <html
      lang={locale}
      className={cn("h-full antialiased", manrope.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta name="turnstile-site-key" content={turnstileSiteKey} />
      </head>
      <body className="mobile-nav-space flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <ThemeProvider initialTheme={initialTheme}>
          <I18nProvider
            initialLocale={locale}
            initialPreferredLanguage={signedIn ? pref : "unknown"}
            initialCookieLocale={cookieLocale}
          >
            {children}
            <OnlinePresenceBeacon enabled={signedIn} />
            <MobileNav />
            <SiteFooter />
            <ConsentBanner signedIn={signedIn} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
