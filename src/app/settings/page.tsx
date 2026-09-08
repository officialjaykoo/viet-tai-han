import { redirect } from "next/navigation";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getOnboardingState } from "@/lib/onboarding";
import { SettingsClient } from "@/components/settings/settings-client";
import { getPushStatus } from "@/lib/push";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { getUserSettings, listBlockedUsers } from "@/lib/user-settings";
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/settings");
  }
  const onboarding = await getOnboardingState(session.user.id);
  if (!onboarding?.onboardingComplete) redirect("/onboarding");

  const { locale } = await getRequestLocale();
  const params = await searchParams;
  const settings = await getUserSettings(session.user.id);
  if (!settings) {
    redirect("/login?next=/settings");
  }
  const [blocked, push, consent, pro] = await Promise.all([
    listBlockedUsers(session.user.id),
    getPushStatus(session.user.id),
    getUserConsent(session.user.id),
    getProStatus(session.user.id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="narrow" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "settings.pageEyebrow")}
            title={tLocale(locale, "settings.pageTitle")}
            description={tLocale(locale, "settings.pageDescription")}
          />
          <SettingsClient
            initialSettings={settings}
            initialBlocked={blocked}
            initialSection={parseSection(params.section)}
            initialPush={{
              available: push.available,
              configuration: push.configuration,
              publicKey: push.publicKey,
              subscribed: push.subscribed,
            }}
            initialConsent={consent}
            initialPro={pro}
          />
        </PageShell>
      </main>
    </>
  );
}
