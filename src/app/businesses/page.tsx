import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import type { Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listBusinesses, type BusinessSummary } from "@/lib/businesses";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type SearchParam = string | string[] | undefined;

function firstParam(value: SearchParam) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function mapHref(business: BusinessSummary) {
  const query = encodeURIComponent(`${business.name}, ${business.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParam>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const category = firstParam(params.category).trim();
  const location = firstParam(params.location).trim();
  const session = await getSession();
  const { locale } = await getRequestLocale();
  const businesses = await listBusinesses({
    query,
    category,
    location,
    viewerUserId: session?.user?.id ?? null,
    limit: 50,
  });
  const loginNext = "/businesses/new";

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <div className="relative mx-auto w-full max-w-5xl space-y-8 safe-px safe-pb py-6 sm:py-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
                {tLocale(locale, "business.eyebrow")}
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {tLocale(locale, "business.titlePage")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tLocale(locale, "business.blurb")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={session ? "/businesses/new" : `/login?next=${encodeURIComponent(loginNext)}`}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {tLocale(locale, "business.createProfile")}
              </Link>
              {session ? (
                <Link
                  href="/businesses/mine"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {tLocale(locale, "business.myBusinesses")}
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <form method="get" className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <label htmlFor="business-q" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "business.search")}
                </label>
                <input
                  id="business-q"
                  name="q"
                  defaultValue={query}
                  placeholder={tLocale(locale, "business.searchPlaceholder")}
                  className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="business-category" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "business.category")}
                </label>
                <input
                  id="business-category"
                  name="category"
                  defaultValue={category}
                  placeholder={tLocale(locale, "business.categoryPlaceholder")}
                  className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor="business-location" className="text-xs font-medium text-muted-foreground">
                    {tLocale(locale, "business.location")}
                  </label>
                  <input
                    id="business-location"
                    name="location"
                    defaultValue={location}
                    placeholder={tLocale(locale, "business.locationPlaceholder")}
                    className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {tLocale(locale, "business.filter")}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-3" aria-labelledby="business-list-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="business-list-title" className="font-heading text-xl font-semibold">
                {tLocale(locale, "business.latest")}
              </h2>
              <span className="text-sm text-muted-foreground">{businesses.length}</span>
            </div>
            {businesses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {tLocale(locale, "business.empty")}
              </div>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {businesses.map((business) => (
                  <li key={business.id}>
                    <article className="h-full rounded-2xl border border-border/60 bg-card/75 p-4 shadow-sm transition-colors hover:bg-muted/40 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                          {business.category}
                        </span>
                        <span>{business.location}</span>
                        <span aria-hidden>·</span>
                        <span>{tLocale(locale, "business.verified")}</span>
                      </div>
                      <Link href={`/businesses/${business.slug}`} className="block">
                        <h3 className="mt-3 font-heading text-lg font-semibold leading-snug text-balance hover:text-[var(--brand)]">
                          {business.name}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {business.description}
                        </p>
                      </Link>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <UserAvatar username={business.owner.username} image={business.owner.image} size="xs" className="ring-0" />
                        <span className="truncate">
                          {tLocale(locale, "business.owner")}: @{business.owner.username ?? "unknown"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{tLocale(locale, "business.serviceCount", { count: business.serviceCount })}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                        <Link
                          href={`/businesses/${business.slug}`}
                          className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
                        >
                          {tLocale(locale, "business.viewProfile")}
                        </Link>
                        <a
                          href={mapHref(business)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                        >
                          {tLocale(locale, "business.openMap")}
                        </a>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
