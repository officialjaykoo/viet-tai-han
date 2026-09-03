import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/marketplace/listing-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewMarketplaceListingPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/marketplace/new")}`);
  }
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl space-y-6 safe-px safe-pb py-6 sm:py-8">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>
          <section className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "marketplace.eyebrow")}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {tLocale(locale, "marketplace.newListing")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {tLocale(locale, "marketplace.contactPolicy")}
            </p>
            <div className="mt-6">
              <ListingForm />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
