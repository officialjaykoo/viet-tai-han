import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingAlertList } from "@/components/marketplace/listing-alert-list";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listListingAlerts } from "@/lib/marketplace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MarketplaceAlertsPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/marketplace/alerts")}`);
  const { locale } = await getRequestLocale();
  const alerts = await listListingAlerts(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="relative mx-auto w-full max-w-3xl space-y-6 safe-px safe-pb py-6 sm:py-8">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>
          <section>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "marketplace.alerts")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tLocale(locale, "marketplace.alertNeedsFilter")}
            </p>
          </section>
          <ListingAlertList initialAlerts={alerts} />
        </div>
      </main>
    </>
  );
}
