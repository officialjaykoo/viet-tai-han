import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingReportForm } from "@/components/marketplace/listing-report-form";
import { ListingSaveButton } from "@/components/marketplace/listing-save-button";
import { ListingStatusControls } from "@/components/marketplace/listing-status-controls";
import { SiteHeader } from "@/components/layout/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { UserAvatar } from "@/components/user/user-avatar";
import type { Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import {
  formatListingPrice,
  getListingDetail,
  type ListingKind,
  type ListingStatus,
} from "@/lib/marketplace";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

function kindLabel(locale: Locale, kind: ListingKind) {
  const key =
    kind === "market"
      ? "marketplace.market"
      : kind === "job"
        ? "marketplace.job"
        : "marketplace.service";
  return tLocale(locale, key);
}

function statusLabel(locale: Locale, status: ListingStatus) {
  const key =
    status === "active"
      ? "marketplace.active"
      : status === "sold"
        ? "marketplace.sold"
        : "marketplace.closed";
  return tLocale(locale, key);
}

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const listing = await getListingDetail(id, session?.user?.id ?? null);
  if (!listing) notFound();

  const sellerName = listing.seller.username ?? "unknown";
  const messageHref = listing.seller.username
    ? `/messages?to=${encodeURIComponent(listing.seller.username)}`
    : null;

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <PageShell width="narrow" className="space-y-6">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>

          <article className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                {kindLabel(locale, listing.kind)}
              </span>
              <span>{listing.category}</span>
              <span aria-hidden>·</span>
              <span>{listing.location}</span>
              <span aria-hidden>·</span>
              <span>{statusLabel(locale, listing.status)}</span>
            </div>
            <h1 className="mt-4 font-heading text-2xl font-semibold leading-tight text-balance sm:text-3xl">
              {listing.title}
            </h1>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] sm:text-base">
              {listing.body}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <UserAvatar
                  username={listing.seller.username}
                  image={listing.seller.image}
                  size="sm"
                  className="ring-0"
                />
                <span className="truncate">
                  {tLocale(locale, "marketplace.seller")}: @{sellerName}
                </span>
                <span aria-hidden>·</span>
                <span>{new Date(listing.createdAt).toLocaleDateString(locale)}</span>
              </div>
              <span className="shrink-0 text-lg font-semibold">
                {formatListingPrice(listing.price) ??
                  tLocale(locale, "marketplace.noPrice")}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ListingSaveButton
                listingId={listing.id}
                initialSaved={listing.saved}
                authenticated={Boolean(session)}
              />
              {messageHref && !listing.seller.isOwner ? (
                <Link
                  href={messageHref}
                  className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  {tLocale(locale, "marketplace.messageSeller")}
                </Link>
              ) : null}
            </div>
          </article>

          <aside className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            {tLocale(locale, "marketplace.contactPolicy")}
          </aside>

          {listing.seller.isOwner ? (
            <ListingStatusControls listingId={listing.id} status={listing.status} />
          ) : null}

          {!listing.seller.isOwner ? (
            <section className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
              <ListingReportForm
                listingId={listing.id}
                authenticated={Boolean(session)}
              />
            </section>
          ) : null}
        </PageShell>
      </main>
    </>
  );
}
