import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/feed/post-card";
import { SiteHeader } from "@/components/layout/site-header";
import { ProfileCommentCard } from "@/components/user/profile-comment-card";
import { ProfileFriends } from "@/components/user/profile-friends";
import { ProfileHeader } from "@/components/user/profile-header";
import { ProfileSidebar } from "@/components/user/profile-sidebar";
import {
  ProfileTabs,
  type ProfileTab,
} from "@/components/user/profile-tabs";
import { listUserAchievements, syncUserAchievements } from "@/lib/achievements";
import {
  getPublicProfile,
  listUserComments,
  type ProfileComment,
} from "@/lib/content";
import { listFriends } from "@/lib/friends";
import { getFeedPosts } from "@/lib/db";
import { parseSqliteDate } from "@/lib/format-time";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import type { FeedPost } from "@/lib/types";
import { getProfileRelation } from "@/lib/user-actions";

export const dynamic = "force-dynamic";

function parseTab(value: string | undefined): ProfileTab {
  if (value === "posts" || value === "comments" || value === "friends") {
    return value;
  }
  return "overview";
}

type OverviewItem =
  | { kind: "post"; createdAt: string; post: FeedPost }
  | { kind: "comment"; createdAt: string; comment: ProfileComment };

function buildOverview(
  posts: FeedPost[],
  comments: ProfileComment[],
  limit = 40
): OverviewItem[] {
  const items: OverviewItem[] = [
    ...posts.map((post) => ({
      kind: "post" as const,
      createdAt: post.createdAt,
      post,
    })),
    ...comments.map((comment) => ({
      kind: "comment" as const,
      createdAt: comment.createdAt,
      comment,
    })),
  ];
  items.sort(
    (a, b) => parseSqliteDate(b.createdAt) - parseSqliteDate(a.createdAt)
  );
  return items.slice(0, limit);
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username: identifier } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  const profile = await getPublicProfile(identifier);
  if (!profile || profile.status === "banned") notFound();

  const session = await getSession();
  const { locale } = await getRequestLocale();
  const isOwner = session?.user?.id === profile.id;
  const relation = await getProfileRelation(session?.user?.id, profile.id);

  // Achievement sync is a heavy multi-subquery write. Awaiting it on every
  // public profile (and Next.js Link prefetch of /u/*) caused Worker CPU
  // exhaustion → intermittent 503s. Owners still sync inline; visitors sync
  // in the background via waitUntil.
  if (isOwner) {
    await syncUserAchievements(profile.id);
  } else {
    try {
      const { ctx } = await getCloudflareContext({ async: true });
      ctx?.waitUntil?.(
        syncUserAchievements(profile.id).catch((error) => {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "achievement_sync_failed",
              userId: profile.id,
              error: error instanceof Error ? error.message : String(error),
            })
          );
        })
      );
    } catch {
      // Non-Workers contexts (unit tests): skip background sync.
    }
  }

  const [display, achievements, postsFeed, comments, friends] = await Promise.all([
    getPublicProfile(identifier),
    listUserAchievements(profile.id),
    getFeedPosts({
      authorId: profile.id,
      limit: 30,
      sort: "new",
      mode: "popular",
      viewerUserId: session?.user?.id ?? null,
    }),
    listUserComments(profile.id, 30),
    listFriends(profile.id),
  ]);
  const user = display ?? profile;
  const posts = postsFeed.posts;
  const overview = buildOverview(posts, comments);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_12%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-6xl safe-px safe-pb py-4 sm:py-6">
          <ProfileHeader
            profile={user}
            isOwner={isOwner}
            relation={relation}
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="min-w-0 space-y-4">
              <Suspense fallback={null}>
                <ProfileTabs current={tab} />
              </Suspense>

              {tab === "overview" ? (
                <ProfileFeed
                  empty={tLocale(locale, "profile.emptyOverview")}
                  items={overview.map((item) =>
                    item.kind === "post" ? (
                      <PostCard
                        key={`p-${item.post.id}`}
                        post={item.post}
                        discoverySource="profile"
                      />
                    ) : (
                      <ProfileCommentCard
                        key={`c-${item.comment.id}`}
                        comment={item.comment}
                        locale={locale}
                      />
                    )
                  )}
                />
              ) : null}

              {tab === "posts" ? (
                <ProfileFeed
                  empty={tLocale(locale, "profile.emptyPosts")}
                  items={posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      discoverySource="profile"
                    />
                  ))}
                />
              ) : null}

              {tab === "comments" ? (
                <ProfileFeed
                  empty={tLocale(locale, "profile.emptyComments")}
                  items={comments.map((comment) => (
                    <ProfileCommentCard
                      key={comment.id}
                      comment={comment}
                      locale={locale}
                    />
                  ))}
                />
              ) : null}
              {tab === "friends" ? (
                <ProfileFriends
                  friends={friends}
                  heading={tLocale(locale, "profile.friends")}
                  empty={tLocale(locale, "profile.emptyFriends")}
                />
              ) : null}
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-20">
                <ProfileSidebar
                  profile={user}
                  achievements={achievements}
                  isOwner={isOwner}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 lg:hidden">
            <ProfileSidebar
              profile={user}
              achievements={achievements}
              isOwner={isOwner}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function ProfileFeed({
  items,
  empty,
}: {
  items: ReactNode[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return <div className="space-y-3">{items}</div>;
}
