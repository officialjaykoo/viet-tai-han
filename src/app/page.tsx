import { CompassIcon, HomeIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Feed } from "@/components/feed/feed";
import { FeedModeTabs, FeedSortTabs } from "@/components/feed/feed-controls";
import { SiteHeader } from "@/components/layout/site-header";
import { withFeedAds } from "@/lib/ads";
import { getFeedPosts, type FeedMode, type FeedSort } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import type { PaginatedFeed } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseSort(value: string | undefined): FeedSort {
  if (value === "new" || value === "top" || value === "hot") return value;
  return "hot";
}

function parseMode(value: string | undefined): "home" | "popular" {
  if (value === "home") return "home";
  return "popular";
}

async function loadInitialFeed(options: {
  sort: FeedSort;
  mode: FeedMode;
  viewerUserId: string | null;
}): Promise<PaginatedFeed> {
  try {
    const feed = await getFeedPosts({
      limit: 20,
      viewerUserId: options.viewerUserId,
      sort: options.sort,
      mode: options.mode,
    });
    return await withFeedAds(feed, options.viewerUserId);
  } catch (error) {
    console.error("Failed to load initial feed", error);
    return { posts: [], nextCursor: null, hasMore: false };
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; feed?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const { locale } = await getRequestLocale();
  const signedIn = Boolean(session?.user);
  const username = (session?.user as { username?: string } | undefined)
    ?.username;
  const profileHref = username
    ? `/u/${encodeURIComponent(username)}`
    : "/login";
  const desktopLinks = [
    { href: "/", label: tLocale(locale, "nav.home"), icon: HomeIcon },
    {
      href: "/communities",
      label: tLocale(locale, "nav.communities"),
      icon: CompassIcon,
    },
    {
      href: "/submit",
      label: tLocale(locale, "nav.createPost"),
      icon: PlusIcon,
    },
    {
      href: profileHref,
      label: tLocale(locale, "nav.profile"),
      icon: UserRoundIcon,
    },
  ];
  const sort = parseSort(params.sort);
  const mode = parseMode(params.feed);
  const initialFeed = await loadInitialFeed({
    sort,
    mode,
    viewerUserId: session?.user?.id ?? null,
  });

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="relative mx-auto grid w-full max-w-3xl safe-px safe-pb py-4 sm:py-6 xl:max-w-[1240px] xl:grid-cols-[220px_minmax(0,680px)_280px] xl:gap-6">
          <aside className="hidden xl:block">
            <nav
              className="sticky top-20 space-y-1"
              aria-label={tLocale(locale, "nav.menu")}
            >
              {desktopLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 xl:col-start-2">
            <section className="mb-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full bg-[var(--flag-gold)] ring-4 ring-[color-mix(in_oklch,var(--flag-gold)_22%,transparent)]"
                />
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                  {mode === "home"
                    ? tLocale(locale, "feed.yourFeed")
                    : tLocale(locale, "feed.popular")}
                </p>
              </div>
              <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Việt tại Hàn
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {mode === "home"
                  ? tLocale(locale, "feed.homeBlurb")
                  : tLocale(locale, "feed.popularBlurb")}
              </p>
            </section>

            <Suspense fallback={null}>
              <FeedModeTabs current={mode} signedIn={signedIn} />
              <FeedSortTabs current={sort} mode={mode} />
            </Suspense>

            <Feed initialFeed={initialFeed} sort={sort} mode={mode} />
          </div>

          <aside className="hidden space-y-4 xl:col-start-3 xl:block">
            <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                {tLocale(locale, "nav.communities")}
              </p>
              <h2 className="mt-2 font-heading text-lg font-semibold">
                Việt tại Hàn
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {tLocale(locale, "meta.description")}
              </p>
              <Link
                href="/communities"
                className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-[var(--brand-foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--brand)_88%,black)]"
              >
                {tLocale(locale, "nav.communities")}
              </Link>
            </section>
            <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                {tLocale(locale, "nav.questions")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tLocale(locale, "questions.blurb")}
              </p>
              <Link
                href="/questions"
                className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[color-mix(in_oklch,var(--flag-gold)_18%,transparent)]"
              >
                {tLocale(locale, "nav.questions")}
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
