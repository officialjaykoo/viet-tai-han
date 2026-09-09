import { Suspense, type ReactNode } from "react";

import { notFound, redirect } from "next/navigation";

import { PostCard } from "@/components/feed/post-card";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/layout/site-header";
import { ProfileCommentCard } from "@/components/user/profile-comment-card";
import { ProfileFriends } from "@/components/user/profile-friends";
import { ProfileHeader } from "@/components/user/profile-header";
import { ProfileSidebar } from "@/components/user/profile-sidebar";
import { ProfileActivity } from "@/components/user/profile-activity";
import {
  ProfileTabs,
  type ProfileTab,
} from "@/components/user/profile-tabs";
import { listUserAchievements } from "@/lib/achievements";

import {
  listUserCommentsPage,
  resolvePublicProfile,
  toPublicProfile,
  type ProfileComment,
} from "@/lib/content";
import { listFriends } from "@/lib/friends";
import { getFeedPosts } from "@/lib/db";
import { parseSqliteDate } from "@/lib/format-time";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import type { FeedPost, OrganicFeedPage } from "@/lib/types";
import { getProfileRelation } from "@/lib/user-actions";
import {
  serializeFeed,
  type PublicFeedPost,
} from "@/lib/serializers";

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

function serializeProfilePosts(
  feed: OrganicFeedPage,
  viewerUserId: string | null
): {
  posts: PublicFeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  const serialized = serializeFeed(
    {
      posts: feed.posts.map((post) => ({ ...post, kind: "post" as const })),
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
    },
    viewerUserId
  );
  return {
    posts: serialized.posts.filter(
      (post): post is PublicFeedPost => post.kind === "post"
    ),
    nextCursor: serialized.nextCursor,
    hasMore: serialized.hasMore,
  };
}

function logProfileStage(msg: string) {
  console.info(JSON.stringify({ msg }));
}
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  console.info(JSON.stringify({ msg: "profile_render_start" }));
  const { username: identifier } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  const lookup = await resolvePublicProfile(identifier);
  logProfileStage("profile_lookup_done");
  if (!lookup || lookup.profile.status === "banned") notFound();
  if (lookup.redirectUsername) {
    const query = tabParam ? `?tab=${encodeURIComponent(tabParam)}` : "";
    redirect(`/u/${encodeURIComponent(lookup.redirectUsername)}${query}`);
  }
  const profileRecord = lookup.profile;
  const profile = toPublicProfile(profileRecord);

  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const isOwner = session?.user?.id === profileRecord.id;
  const relation = await getProfileRelation(session?.user?.id, profileRecord.id);
  if (!relation.canViewProfile) notFound();

  const viewerUserId = session?.user?.id ?? null;
  let achievements: Awaited<ReturnType<typeof listUserAchievements>>;
  let postsFeed: OrganicFeedPage = {
    posts: [],
    nextCursor: null,
    hasMore: false,
  };
  let commentsPage: Awaited<ReturnType<typeof listUserCommentsPage>> = {
    comments: [],
    nextCursor: null,
    hasMore: false,
  };
  let friends: Awaited<ReturnType<typeof listFriends>> = [];

  if (tab === "overview") {
    [achievements, postsFeed, commentsPage] = await Promise.all([
      listUserAchievements(profileRecord.id),
      getFeedPosts({
        authorId: profileRecord.id,
        limit: 30,
        sort: "new",
        mode: "popular",
        viewerUserId,
      }),
      listUserCommentsPage(profileRecord.id, { limit: 30 }),
    ]);
  } else if (tab === "posts") {
    [achievements, postsFeed] = await Promise.all([
      listUserAchievements(profileRecord.id),
      getFeedPosts({
        authorId: profileRecord.id,
        limit: 30,
        sort: "new",
        mode: "popular",
        viewerUserId,
      }),
    ]);
  } else if (tab === "comments") {
    [achievements, commentsPage] = await Promise.all([
      listUserAchievements(profileRecord.id),
      listUserCommentsPage(profileRecord.id, { limit: 30 }),
    ]);
  } else {
    [achievements, friends] = await Promise.all([
      listUserAchievements(profileRecord.id),
      listFriends(profileRecord.id),
    ]);
  }
  logProfileStage("profile_data_done");
  const posts = postsFeed.posts;
  const comments = commentsPage.comments;
  const initialProfilePosts =
    tab === "posts" ? serializeProfilePosts(postsFeed, viewerUserId) : undefined;
  const overview = buildOverview(posts, comments);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="wide" className="py-4 sm:py-6">
          <ProfileHeader
            profile={profile}
            targetUserId={profileRecord.id}
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

              {tab === "posts" && initialProfilePosts ? (
                <ProfileActivity
                  key={`${profileRecord.id}-posts`}
                  username={profile.username ?? identifier}
                  tab="posts"
                  locale={locale}
                  initialPosts={initialProfilePosts}
                  empty={tLocale(locale, "profile.emptyPosts")}
                />
              ) : null}

              {tab === "comments" ? (
                <ProfileActivity
                  key={`${profileRecord.id}-comments`}
                  username={profile.username ?? identifier}
                  tab="comments"
                  locale={locale}
                  initialComments={commentsPage}
                  empty={tLocale(locale, "profile.emptyComments")}
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
                  profile={profile}
                  achievements={achievements}
                  isOwner={isOwner}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 lg:hidden">
            <ProfileSidebar
              profile={profile}
              achievements={achievements}
              isOwner={isOwner}
            />
          </div>
        </PageShell>
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
    return <EmptyState>{empty}</EmptyState>;
  }

  return <div className="space-y-3">{items}</div>;
}
