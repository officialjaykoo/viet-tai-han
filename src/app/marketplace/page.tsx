import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { ListingAlertButton } from "@/components/marketplace/listing-alert-button";
import { ListingSaveButton } from "@/components/marketplace/listing-save-button";
import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import type { Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import {
  LISTING_KINDS,
  LISTING_STATUSES,
  formatListingPrice,
  listListings,
  type ListingKind,
  type ListingStatus,
} from "@/lib/marketplace";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

type SearchParam = string | string[] | undefined;

function firstParam(value: SearchParam) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isKind(value: string): value is ListingKind {
  return (LISTING_KINDS as readonly string[]).includes(value);
}

function isStatus(value: string): value is ListingStatus | "all" {
  return value === "all" || (LISTING_STATUSES as readonly string[]).includes(value);
}

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

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParam>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const kindParam = firstParam(params.kind);
  const statusParam = firstParam(params.status);
  const category = firstParam(params.category).trim();
  const location = firstParam(params.location).trim();
  const kind = isKind(kindParam) ? kindParam : null;
  const status = isStatus(statusParam) ? statusParam : null;
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const listings = await listListings({
    query,
    kind,
    category,
    location,
    status,
    viewerUserId: session?.user?.id ?? null,
    limit: 50,
  });

  const loginNext = "/marketplace/new";

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <PageShell width="standard" className="space-y-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
                {tLocale(locale, "marketplace.eyebrow")}
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {tLocale(locale, "marketplace.titlePage")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tLocale(locale, "marketplace.blurb")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={session ? "/marketplace/new" : `/login?next=${encodeURIComponent(loginNext)}`}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {tLocale(locale, "marketplace.newListing")}
              </Link>
              {session ? (
                <>
                  <Link
                    href="/marketplace/saved"
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {tLocale(locale, "marketplace.saved")}
                  </Link>
                  <Link
                    href="/marketplace/alerts"
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {tLocale(locale, "marketplace.alerts")}
                  </Link>
                </>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5 lg:col-span-2">
                <label htmlFor="marketplace-q" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "nav.search")}
                </label>
                <input
                  id="marketplace-q"
                  name="q"
                  defaultValue={query}
                  placeholder={tLocale(locale, "search.placeholderCompact")}
                  className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="marketplace-kind" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "marketplace.kind")}
                </label>
                <select
                  id="marketplace-kind"
                  name="kind"
                  defaultValue={kind ?? ""}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="">{tLocale(locale, "marketplace.allKinds")}</option>
                  {LISTING_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {kindLabel(locale, value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="marketplace-status" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "marketplace.status")}
                </label>
                <select
                  id="marketplace-status"
                  name="status"
                  defaultValue={status ?? "active"}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="active">{tLocale(locale, "marketplace.active")}</option>
                  <option value="all">{tLocale(locale, "marketplace.allStatuses")}</option>
                  <option value="sold">{tLocale(locale, "marketplace.sold")}</option>
                  <option value="closed">{tLocale(locale, "marketplace.closed")}</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {tLocale(locale, "marketplace.filter")}
                </button>
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <label htmlFor="marketplace-category" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "marketplace.category")}
                </label>
                <input
                  id="marketplace-category"
                  name="category"
                  defaultValue={category}
                  placeholder={tLocale(locale, "marketplace.categoryPlaceholder")}
                  className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="marketplace-location" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "marketplace.location")}
                </label>
                <input
                  id="marketplace-location"
                  name="location"
                  defaultValue={location}
                  placeholder={tLocale(locale, "marketplace.locationPlaceholder")}
                  className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
            </form>
            {session ? (
              <div className="mt-4 border-t border-border/50 pt-4">
                <ListingAlertButton
                  query={query}
                  kind={kind}
                  category={category}
                  location={location}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3" aria-labelledby="marketplace-list-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="marketplace-list-title" className="font-heading text-xl font-semibold">
                {tLocale(locale, "marketplace.latest")}
              </h2>
              <span className="text-sm text-muted-foreground">{listings.length}</span>
            </div>
            {listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {tLocale(locale, "marketplace.empty")}
              </div>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {listings.map((listing) => (
                  <li key={listing.id}>
                    <article className="h-full rounded-2xl border border-border/60 bg-card/75 p-4 shadow-sm transition-colors hover:bg-muted/40 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                            {kindLabel(locale, listing.kind)}
                          </span>
                          <span className="truncate">{listing.category}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{listing.location}</span>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {statusLabel(locale, listing.status)}
                        </span>
                      </div>
                      <Link href={`/marketplace/${listing.id}`} className="block">
                        <h3 className="mt-3 font-heading text-lg font-semibold leading-snug text-balance hover:text-[var(--brand)]">
                          {listing.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {listing.body}
                        </p>
                      </Link>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <UserAvatar
                            username={listing.seller.username}
                            image={listing.seller.image}
                            size="xs"
                            className="ring-0"
                          />
                          <span className="truncate">
                            {tLocale(locale, "marketplace.by")} @
                            {listing.seller.username ?? "unknown"}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{new Date(listing.createdAt).toLocaleDateString(locale)}</span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {formatListingPrice(listing.price) ??
                            tLocale(locale, "marketplace.noPrice")}
                        </span>
                      </div>
                      <div className="mt-3">
                        <ListingSaveButton
                          listingId={listing.id}
                          initialSaved={listing.saved}
                          authenticated={Boolean(session)}
                        />
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </PageShell>
      </main>
    </>
  );
}
