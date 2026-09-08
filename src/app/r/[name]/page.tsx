import Link from "next/link";
import { notFound } from "next/navigation";

import { SubscribeButton } from "@/components/communities/subscribe-button";
import { Feed } from "@/components/feed/feed";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
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

function parseSort(_value: string | undefined): FeedSort {
  return "new";
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
        <PageBackdrop />
        <PageShell width="standard">
          <div className="max-w-[760px] space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "communities.title")}
            title={sub.name}
            description={
              <>
                <p>{sub.title}</p>
                {sub.description ? <p className="mt-2">{sub.description}</p> : null}
              </>
            }
            actions={
              <>
                <SubscribeButton
                  name={sub.name}
                  initialSubscribed={joined}
                  initialCount={sub.subscriber_count}
                />
                <Link
                  href={`/r/${sub.name}/submit`}
                  className={buttonVariants({ size: "sm" })}
                >
                  {tLocale(locale, "nav.createPost")}
                </Link>
              </>
            }
          />
          <Feed
            initialFeed={initialFeed}
            subreddit={sub.name}
            sort={sort}
            mode="community"
          />
          </div>
        </PageShell>
      </main>
    </>
  );
}
