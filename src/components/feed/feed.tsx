"use client";

import { useCallback, useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";

import { AdFeedCard } from "@/components/ads/ad-feed-card";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { FeedMode, FeedSort } from "@/lib/db";
import type { FeedItem, PaginatedFeed } from "@/lib/types";

interface FeedProps {
  initialFeed: PaginatedFeed;
  subreddit?: string;
  sort?: FeedSort;
  mode?: FeedMode;
}

function discoveryForMode(
  mode: FeedMode
): "home" | "popular" | "community" {
  if (mode === "home") return "home";
  if (mode === "community") return "community";
  return "popular";
}

export function Feed({
  initialFeed,
  subreddit,
  sort = "hot",
  mode = "popular",
}: FeedProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<FeedItem[]>(initialFeed.posts);
  const [cursor, setCursor] = useState<string | null>(initialFeed.nextCursor);
  const [hasMore, setHasMore] = useState(initialFeed.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discoverySource = discoveryForMode(mode);

  useEffect(() => {
    setItems(initialFeed.posts);
    setCursor(initialFeed.nextCursor);
    setHasMore(initialFeed.hasMore);
  }, [initialFeed]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cursor,
        limit: "20",
        sort,
        feed: mode,
      });
      if (subreddit) params.set("subreddit", subreddit);
      const response = await apiFetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load more posts");
      }

      const page = (await response.json()) as PaginatedFeed;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        const next = page.posts.filter((item) => !seen.has(item.id));
        return [...current, ...next];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setError(t("feed.loadMoreError"));
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, subreddit, sort, mode, t]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
        <p className="font-heading text-lg font-semibold">{t("feed.noPosts")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "home"
            ? t("feed.emptyHomeHint")
            : t("feed.emptyPopularHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[50dvh]">
      <Virtuoso
        useWindowScroll
        data={items}
        initialItemCount={Math.min(items.length, 12)}
        defaultItemHeight={160}
        increaseViewportBy={{ top: 200, bottom: 600 }}
        endReached={() => {
          void loadMore();
        }}
        overscan={600}
        computeItemKey={(_index, item) => item.id}
        itemContent={(_index, item) => (
          <div className="pb-3">
            {item.kind === "ad" ? (
              <AdFeedCard ad={item} />
            ) : (
              <PostCard post={item} discoverySource={discoverySource} />
            )}
          </div>
        )}
        components={{
          Footer: () => (
            <div className="safe-pb py-6 text-center text-sm text-muted-foreground">
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
                    onClick={() => {
                      void loadMore();
                    }}
                  >
                    {t("feed.tryAgain")}
                  </Button>
                </div>
              ) : loading ? (
                <p aria-live="polite">{t("feed.loadingMore")}</p>
              ) : hasMore ? (
                <p>{t("feed.scrollForMore")}</p>
              ) : (
                <p>{t("feed.caughtUp")}</p>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
