import { redirect } from "next/navigation";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getEnv } from "@/lib/db";
import { getOAuthProviderCapabilities } from "@/lib/oauth-providers";
import { getOnboardingState } from "@/lib/onboarding";
import { SettingsClient } from "@/components/settings/settings-client";
import { getPushStatus } from "@/lib/push";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { getUserSettings, listBlockedUsers, listMutedUsers } from "@/lib/user-settings";
import { getProStatus, getUserConsent } from "@/lib/monetization";

export const dynamic = "force-dynamic";

type Section =
  | "profile"
  | "account"
  | "appearance"
  | "privacy"
  | "notifications";

function parseSection(value: string | undefined): Section {
  if (
    value === "account" ||
    value === "appearance" ||
    value === "privacy" ||
    value === "notifications" ||
    value === "profile"
  ) {
    return value;
  }
  return "profile";
}

function getIdentityCallbackError(params: {
  error?: string;
  error_description?: string;
}): string | undefined {
  const value = params.error?.trim() || params.error_description?.trim();
  if (!value) return undefined;
  // Known Better Auth/provider codes are localized on the client. Unknown or
  // verbose provider text is reduced to a safe public fallback.
  if (/^(KOE\d{3}|access_denied|cancelled|canceled)$/i.test(value)) {
    return value.slice(0, 80);
  }
  return "Could not link account";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/settings");
  }
  const onboarding = await getOnboardingState(session.user.id);
  if (!onboarding?.onboardingComplete) redirect("/onboarding");

  const { locale } = await getRequestLocale();
  const params = await searchParams;
  const env = await getEnv();
  const settings = await getUserSettings(session.user.id);
  if (!settings) {
    redirect("/login?next=/settings");
  }
  const [blocked, muted, push, consent, pro] = await Promise.all([
    listBlockedUsers(session.user.id),
    listMutedUsers(session.user.id),
    getPushStatus(session.user.id),
    getUserConsent(session.user.id),
    getProStatus(session.user.id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="compact" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "settings.pageEyebrow")}
            title={tLocale(locale, "settings.pageTitle")}
            description={tLocale(locale, "settings.pageDescription")}
          />
          <SettingsClient
            initialSettings={settings}
            initialBlocked={blocked}
            initialMuted={muted}
            initialSection={parseSection(params.section)}
            initialIdentityError={getIdentityCallbackError(params)}
            oauthProviders={getOAuthProviderCapabilities(env)}
            initialPush={{
              available: push.available,
              configuration: push.configuration,
              publicKey: push.publicKey,
              currentDeviceSubscribed: push.currentDeviceSubscribed,
              activeDeviceCount: push.activeDeviceCount,
              hasAnySubscription: push.hasAnySubscription,
            }}
            initialConsent={consent}
            initialPro={pro}
          />
        </PageShell>
      </main>
    </>
  );
}
