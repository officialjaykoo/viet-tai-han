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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_18%,transparent),transparent_65%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl safe-px safe-pb py-6 sm:py-8">
          <section className="mb-6">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {mode === "home"
                ? tLocale(locale, "feed.yourFeed")
                : tLocale(locale, "feed.popular")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              red
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
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
      </main>
    </>
  );
}
