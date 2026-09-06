import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SubscribeButton } from "@/components/communities/subscribe-button";
import { Feed } from "@/components/feed/feed";
import { FeedSortTabs } from "@/components/feed/feed-controls";
import { SiteHeader } from "@/components/layout/site-header";
import { withFeedAds } from "@/lib/ads";
import { isSubscribed } from "@/lib/communities";
import { getSubredditByName } from "@/lib/content";
import { getFeedPosts, type FeedSort } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

function parseSort(value: string | undefined): FeedSort {
  if (value === "new" || value === "top" || value === "hot") return value;
  return "hot";
}

export default async function SubredditPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { name } = await params;
  const { sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);
  const sub = await getSubredditByName(name);
  if (!sub || sub.is_removed) notFound();

  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const joined = session?.user
    ? await isSubscribed(session.user.id, sub.id)
    : false;

  const initialFeed = await withFeedAds(
    await getFeedPosts({
      subreddit: sub.name,
      limit: 20,
      viewerUserId: session?.user?.id ?? null,
      sort,
      mode: "community",
    }),
    session?.user?.id ?? null
  );

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-3xl safe-px safe-pb py-6 sm:py-8">
          <section className="mb-6 space-y-3">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "communities.title")}
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {sub.name}
            </h1>
            <p className="text-lg text-muted-foreground">{sub.title}</p>
            {sub.description ? (
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {sub.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <SubscribeButton
                name={sub.name}
                initialSubscribed={joined}
                initialCount={sub.subscriber_count}
              />
              <Link
                href={`/r/${sub.name}/submit`}
                className="inline-flex h-9 items-center justify-center rounded-4xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                {tLocale(locale, "nav.createPost")}
              </Link>
            </div>
          </section>
          <Suspense fallback={null}>
            <FeedSortTabs current={sort} />
          </Suspense>
          <Feed
            initialFeed={initialFeed}
            subreddit={sub.name}
            sort={sort}
            mode="community"
          />
        </div>
      </main>
    </>
  );
}
