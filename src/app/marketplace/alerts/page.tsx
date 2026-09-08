import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingAlertList } from "@/components/marketplace/listing-alert-list";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listListingAlerts } from "@/lib/marketplace";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function MarketplaceAlertsPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/marketplace/alerts")}`);
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();
  const alerts = await listListingAlerts(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="space-y-6">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>
          <PageHero
            eyebrow={tLocale(locale, "marketplace.eyebrow")}
            title={tLocale(locale, "marketplace.alerts")}
            description={tLocale(locale, "marketplace.alertNeedsFilter")}
          />
          <ListingAlertList initialAlerts={alerts} />
        </PageShell>
      </main>
    </>
  );
}
