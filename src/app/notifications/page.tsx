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
      <main className="flex-1">
        <PageShell width="standard" className="space-y-6">
          <div>
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "notifications.activity")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "notifications.title")}
            </h1>
          </div>
          <NotificationsClient />
        </PageShell>
      </main>
    </>
  );
}
