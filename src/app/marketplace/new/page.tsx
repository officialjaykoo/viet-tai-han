import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/marketplace/listing-form";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function NewMarketplaceListingPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/marketplace/new")}`);
  }
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="narrow" className="space-y-6">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>
          <PageHero
            eyebrow={tLocale(locale, "marketplace.eyebrow")}
            title={tLocale(locale, "marketplace.newListing")}
            description={tLocale(locale, "marketplace.contactPolicy")}
          />
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <ListingForm />
          </div>
        </PageShell>
      </main>
    </>
  );
}
