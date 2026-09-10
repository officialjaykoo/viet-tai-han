import Link from "next/link";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listBusinesses, type BusinessSummary } from "@/lib/businesses";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

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
  await redirectIfIncompleteOnboarding(session?.user?.id);
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
        <PageBackdrop />
        <PageShell width="standard" className="space-y-8">
          <PageHero
            eyebrow={tLocale(locale, "business.eyebrow")}
            title={tLocale(locale, "business.titlePage")}
            description={tLocale(locale, "business.blurb")}
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={
                    session
                      ? "/businesses/new"
                      : `/login?next=${encodeURIComponent(loginNext)}`
                  }
                  className={buttonVariants({ size: "sm" })}
                >
                  {tLocale(locale, "business.createProfile")}
                </Link>
                {session ? (
                  <Link
                    href="/businesses/mine"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {tLocale(locale, "business.myBusinesses")}
                  </Link>
                ) : null}
              </div>
            }
          />

          <section className="rounded-3xl border border-border/60 bg-card/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <form method="get" className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <label htmlFor="business-q" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "business.search")}
                </label>
                <Input
                  id="business-q"
                  name="q"
                  defaultValue={query}
                  placeholder={tLocale(locale, "business.searchPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="business-category" className="text-xs font-medium text-muted-foreground">
                  {tLocale(locale, "business.category")}
                </label>
                <Input
                  id="business-category"
                  name="category"
                  defaultValue={category}
                  placeholder={tLocale(locale, "business.categoryPlaceholder")}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor="business-location" className="text-xs font-medium text-muted-foreground">
                    {tLocale(locale, "business.location")}
                  </label>
                  <Input
                    id="business-location"
                    name="location"
                    defaultValue={location}
                    placeholder={tLocale(locale, "business.locationPlaceholder")}
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  {tLocale(locale, "business.filter")}
                </Button>
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
              <EmptyState>{tLocale(locale, "business.empty")}</EmptyState>
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
                        {business.owner.username ? (
                          <Link
                            href={`/u/${encodeURIComponent(business.owner.username)}`}
                            className="flex min-w-0 items-center gap-2 hover:text-foreground"
                          >
                            <UserAvatar
                              username={business.owner.username}
                              image={business.owner.image}
                              size="xs"
                              className="ring-0"
                            />
                            <span className="truncate">
                              {tLocale(locale, "business.owner")}: @
                              {business.owner.username}
                            </span>
                          </Link>
                        ) : (
                          <>
                            <UserAvatar
                              username={business.owner.username}
                              image={business.owner.image}
                              size="xs"
                              className="ring-0"
                            />
                            <span className="truncate">
                              {tLocale(locale, "business.owner")}: @unknown
                            </span>
                          </>
                        )}
                        <span aria-hidden>·</span>
                        <span>{tLocale(locale, "business.serviceCount", { count: business.serviceCount })}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                        <Link
                          href={`/businesses/${business.slug}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          {tLocale(locale, "business.viewProfile")}
                        </Link>
                        <a
                          href={mapHref(business)}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
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
        </PageShell>
      </main>
    </>
  );
}
