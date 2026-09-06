import { cookies, headers } from "next/headers";

import {
  LANG_COOKIE,
  resolveLocale,
  type Locale,
  type PreferredLanguage,
} from "@/lib/i18n/config";
import { getSession } from "@/lib/session";

export async function getRequestLocale(): Promise<{
  locale: Locale;
  preferredLanguage: PreferredLanguage;
  cookieLocale: string | null;
  signedIn: boolean;
}> {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const cookieLocale = jar.get(LANG_COOKIE)?.value ?? null;
  const session = await getSession();
  const preferredLanguage = ((session?.user as { preferredLanguage?: string } | undefined)
    ?.preferredLanguage ?? "unknown") as PreferredLanguage;
  const signedIn = Boolean(session?.user);
  const locale = resolveLocale({
    preferredLanguage: signedIn ? preferredLanguage : null,
    cookieLocale,
    acceptLanguage: requestHeaders.get("accept-language"),
    countryCode:
      requestHeaders.get("cf-ipcountry") ??
      requestHeaders.get("x-vercel-ip-country"),
  });
  return { locale, preferredLanguage, cookieLocale, signedIn };
}
