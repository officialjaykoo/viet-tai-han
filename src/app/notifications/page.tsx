import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { NotificationsClient } from "@/components/notifications/notifications-client";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/notifications");
  }
  await redirectIfIncompleteOnboarding(session.user.id);

  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "notifications.activity")}
            title={tLocale(locale, "notifications.title")}
            description={tLocale(locale, "notifications.description")}
          />
          <NotificationsClient />
        </PageShell>
      </main>
    </>
  );
}
