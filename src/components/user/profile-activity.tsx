"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { PostCard } from "@/components/feed/post-card";
import { ProfileCommentCard } from "@/components/user/profile-comment-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { apiFetch } from "@/lib/api-client";
import type { ProfileComment, ProfileCommentPage } from "@/lib/content";
import type { PublicFeedPost } from "@/lib/serializers";

type ProfilePostPage = {
  posts: PublicFeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ProfileActivityProps = {
  username: string;
  tab: "posts" | "comments";
  locale: "vi" | "ko" | "en";
  initialPosts?: ProfilePostPage;
  initialComments?: ProfileCommentPage;
  empty: string;
};

export function ProfileActivity({
  username,
  tab,
  locale,
  initialPosts,
  initialComments,
  empty,
}: ProfileActivityProps) {
  const { t } = useI18n();
  const [posts, setPosts] = useState<PublicFeedPost[]>(
    initialPosts?.posts ?? []
  );
  const [comments, setComments] = useState<ProfileComment[]>(
    initialComments?.comments ?? []
  );
  const [cursor, setCursor] = useState<string | null>(
    tab === "posts"
      ? initialPosts?.nextCursor ?? null
      : initialComments?.nextCursor ?? null
  );
  const [hasMore, setHasMore] = useState(
    tab === "posts"
      ? initialPosts?.hasMore ?? false
      : initialComments?.hasMore ?? false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/profile/${encodeURIComponent(username)}?tab=${tab}&limit=30&cursor=${encodeURIComponent(cursor)}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error(t("feed.loadMoreError"));
      }
      const page = payload as {
        posts?: PublicFeedPost[];
        comments?: ProfileComment[];
        nextCursor?: string | null;
        hasMore?: boolean;
      };
      if (
        (!Array.isArray(page.posts) && !Array.isArray(page.comments)) ||
        typeof page.hasMore !== "boolean" ||
        (page.nextCursor !== undefined &&
          page.nextCursor !== null &&
          typeof page.nextCursor !== "string")
      ) {
        throw new Error(t("feed.loadMoreError"));
      }
      if (tab === "posts" && Array.isArray(page.posts)) {
        setPosts((current) => {
          const seen = new Set(current.map((post) => post.id));
          return [
            ...current,
            ...page.posts!.filter((post) => !seen.has(post.id)),
          ];
        });
      }
      if (tab === "comments" && Array.isArray(page.comments)) {
        setComments((current) => {
          const seen = new Set(current.map((comment) => comment.id));
          return [
            ...current,
            ...page.comments!.filter((comment) => !seen.has(comment.id)),
          ];
        });
      }
      setCursor(page.nextCursor ?? null);
      setHasMore(page.hasMore === true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("feed.loadMoreError")
      );
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, tab, t, username]);

  const itemCount = tab === "posts" ? posts.length : comments.length;
  if (itemCount === 0 && !loading) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className="space-y-3">
      {tab === "posts"
        ? posts.map((post) => (
            <PostCard key={post.id} post={post} discoverySource="profile" />
          ))
        : comments.map((comment) => (
            <ProfileCommentCard
              key={comment.id}
              comment={comment}
              locale={locale}
            />
          ))}
      <div className="safe-pb py-4 text-center text-sm text-muted-foreground">
        {error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-destructive" role="alert">
              {error}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => void loadMore()}
            >
              {t("feed.tryAgain")}
            </Button>
          </div>
        ) : loading ? (
          <p aria-live="polite">{t("feed.loadingMore")}</p>
        ) : hasMore ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void loadMore()}
          >
            {t("feed.scrollForMore")}
          </Button>
        ) : (
          <p>{t("feed.caughtUp")}</p>
        )}
      </div>
    </div>
  );
}
