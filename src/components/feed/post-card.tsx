"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  shouldOfferTranslation,
} from "@/components/content/translate-toggle";
import { RelativeTime } from "@/components/time/relative-time";
import { VoteControls } from "@/components/votes/vote-controls";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostMedia } from "@/components/posts/post-media";
import { PostOverflowMenu } from "@/components/posts/post-overflow-menu";
import { SubredditLabel } from "@/components/posts/subreddit-label";
import { AccountTags } from "@/components/user/account-tags";
import { UserAvatar } from "@/components/user/user-avatar";
import type {
  FeedPost,
  VoteAction,
  VoteResult,
  ViewerVote,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-client";

interface PostCardProps {
  post: FeedPost;
  discoverySource?: "home" | "popular" | "community" | "profile" | "search";
}

export function PostCard({
  post,
  discoverySource = "popular",
}: PostCardProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const localizeError = useLocalizedError();
  const [score, setScore] = useState(post.score);
  const [viewerVote, setViewerVote] = useState<ViewerVote>(post.viewerVote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    setScore(post.score);
    setViewerVote(post.viewerVote);
    setDismissed(false);
    setShowTranslation(false);
  }, [post.id, post.score, post.viewerVote]);

  const offerTranslation = shouldOfferTranslation(post.translation, locale);
  const showing =
    offerTranslation && showTranslation && post.translation?.status === "ready";
  const displayTitle =
    showing && post.translation?.titleTranslated
      ? post.translation.titleTranslated
      : post.title;
  const displayBody = showing
    ? (post.translation?.bodyTranslated ?? post.body)
    : post.body;

  if (dismissed) {
    return null;
  }

  function applyVote(action: VoteAction) {
    if (viewerVote === action || pending) {
      return;
    }

    setError(null);
    const previous = viewerVote;
    const snapshot = { score, viewerVote };
    setViewerVote(action);

    // Optimistic score nudge — server returns the real weighted score.
    if (previous === null) {
      setScore((v) => v + (action === "upvote" ? 1 : -1));
    } else {
      setScore((v) => v + (action === "upvote" ? 2 : -2));
    }

    startTransition(async () => {
      try {
        const response = await apiFetch(`/api/posts/${post.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (response.status === 401) {
          setScore(snapshot.score);
          setViewerVote(snapshot.viewerVote);
          router.push(
            `/login?next=${encodeURIComponent(`/post/${post.id}`)}`
          );
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "Vote failed");
        }

        const result = (await response.json()) as VoteResult;
        setScore(result.score);
        setViewerVote(result.viewerVote);
      } catch (voteError) {
        setScore(snapshot.score);
        setViewerVote(snapshot.viewerVote);
        setError(
          localizeError(
            voteError instanceof Error ? voteError.message : null,
            "Couldn't apply vote. Try again."
          )
        );
      }
    });
  }

  const postHref = `/post/${post.id}?src=${discoverySource}`;


  function openPost(event: React.MouseEvent | React.KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "a, button, input, textarea, select, [role='menuitem'], [data-no-nav]"
      )
    ) {
      return;
    }
    router.push(postHref);
  }

  return (
    <article>
      <Card
        size="sm"
        className={cn(
          "rounded-2xl bg-card/90 shadow-sm ring-border/60 backdrop-blur-sm",
          "transition-[transform,box-shadow] duration-200",
          "motion-safe:hover:shadow-md [@media(hover:hover)_and_(pointer:fine)]:motion-safe:hover:-translate-y-0.5"
        )}
      >
        <div className="flex gap-1 sm:gap-2">
          <div data-no-nav>
            <VoteControls
              score={score}
              viewerVote={viewerVote}
              pending={pending}
              onVote={applyVote}
            />
          </div>

          <div
            className="min-w-0 flex-1 cursor-pointer overflow-hidden"
            onClick={openPost}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                // Let nested links/buttons handle their own keys
                const target = event.target as HTMLElement;
                if (target !== event.currentTarget) return;
                event.preventDefault();
                router.push(postHref);
              }
            }}
          >
            <CardHeader className="gap-1 px-3 pt-3 pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-anywhere text-xs text-muted-foreground">
                  <UserAvatar
                    username={post.author.username}
                    image={post.author.image}
                    size="xs"
                    className="ring-0"
                  />
                  <SubredditLabel
                    name={post.subreddit.name}
                    className="font-medium text-foreground"
                  />
                  <span aria-hidden>·</span>
                  <Link
                    href={`/u/${post.author.username}`}
                    prefetch={false}
                    className="hover:underline"
                  >
                    u/{post.author.username}
                  </Link>
                  <AccountTags tags={post.author.tags} />
                  <span aria-hidden>·</span>
                  <RelativeTime value={post.createdAt} />
                </p>
                <div data-no-nav>
                  <PostOverflowMenu
                    postId={post.id}
                    authorUsername={post.author.username}
                    onDismiss={() => setDismissed(true)}
                  />
                </div>
              </div>
              <CardTitle className="font-heading break-anywhere text-base leading-snug font-semibold tracking-tight text-balance sm:text-[1.05rem]">
                <Link href={postHref} className="hover:underline">
                  {displayTitle}
                </Link>
              </CardTitle>
            </CardHeader>

            {displayBody ? (
              <CardContent className="px-3 pt-2 pb-0">
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {displayBody}
                </p>
              </CardContent>
            ) : null}

            {post.mediaKey ? (
              <CardContent className="px-3 pt-2 pb-0">
                <PostMedia
                  mediaKey={post.mediaKey}
                  alt={displayTitle}
                  className="max-h-80"
                />
              </CardContent>
            ) : null}

            <CardFooter className="flex-wrap gap-3 px-3 pt-3 pb-3">
              <Link
                href={postHref}
                className="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                {post.commentCount}{" "}
                {post.commentCount === 1
                  ? t("feed.comment")
                  : t("feed.comments")}
              </Link>
              {offerTranslation ? (
                <button
                  type="button"
                  data-no-nav
                  className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                  aria-pressed={showTranslation}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTranslation((v) => !v);
                  }}
                >
                  {showTranslation
                    ? t("translate.showOriginal")
                    : t("translate.action")}
                </button>
              ) : null}
              {error ? (
                <span className="text-xs text-destructive" role="alert">
                  {error}
                </span>
              ) : null}
            </CardFooter>
          </div>
        </div>
      </Card>
    </article>
  );
}
