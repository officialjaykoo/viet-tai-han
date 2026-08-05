import { cookies } from "next/headers";

import {
  LANG_COOKIE,
  isLocale,
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
  const jar = await cookies();
  const cookieLocale = jar.get(LANG_COOKIE)?.value ?? null;
  const session = await getSession();
  const preferredLanguage = ((session?.user as { preferredLanguage?: string } | undefined)
    ?.preferredLanguage ?? "unknown") as PreferredLanguage;
  const signedIn = Boolean(session?.user);
  const locale = resolveLocale({
    preferredLanguage: signedIn ? preferredLanguage : null,
    cookieLocale,
  });
  return { locale, preferredLanguage, cookieLocale, signedIn };
}
