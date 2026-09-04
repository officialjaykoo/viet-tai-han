"use client";

import { MessageCircleIcon, Share2Icon } from "lucide-react";
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
import { apiFetch } from "@/lib/api-client";

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
    const resetId = window.setTimeout(() => {
      setScore(post.score);
      setViewerVote(post.viewerVote);
      setDismissed(false);
      setShowTranslation(false);
    }, 0);
    return () => window.clearTimeout(resetId);
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
  async function sharePost(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const url = new URL(postHref, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: displayTitle, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Sharing can be cancelled by the user.
    }
  }


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
          "rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(0_0_0_/_8%)]",
          "transition-[box-shadow] duration-200",
          "motion-safe:hover:shadow-md"
        )}
      >
        <div
          className="min-w-0 cursor-pointer overflow-hidden"
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
          <CardHeader className="gap-3 px-4 pt-4 pb-0">
            <div className="flex items-center gap-2.5">
              <UserAvatar
                username={post.author.username}
                image={post.author.image}
                size="sm"
                className="ring-0"
              />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 break-anywhere text-sm">
                  <Link
                    href={`/u/${post.author.username}`}
                    prefetch={false}
                    className="font-semibold text-foreground hover:underline"
                  >
                    @{post.author.username}
                  </Link>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <SubredditLabel
                    name={post.subreddit.name}
                    className="font-medium text-muted-foreground hover:text-foreground"
                  />
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <RelativeTime value={post.createdAt} />
                  <AccountTags tags={post.author.tags} />
                </p>
              </div>
              <div data-no-nav>
                <PostOverflowMenu
                  postId={post.id}
                  authorUsername={post.author.username}
                  onDismiss={() => setDismissed(true)}
                />
              </div>
            </div>
            <CardTitle className="break-anywhere text-lg leading-snug font-semibold tracking-tight text-balance">
              <Link href={postHref} className="hover:underline">
                {displayTitle}
              </Link>
            </CardTitle>
          </CardHeader>

          {displayBody ? (
            <CardContent className="px-4 pt-2 pb-0">
              <p className="line-clamp-4 text-[15px] leading-relaxed text-card-foreground/85 [overflow-wrap:anywhere]">
                {displayBody}
              </p>
            </CardContent>
          ) : null}

          {post.mediaKey ? (
            <CardContent className="px-4 pt-3 pb-0">
              <PostMedia
                mediaKey={post.mediaKey}
                alt={displayTitle}
                className="max-h-[32rem]"
              />
            </CardContent>
          ) : null}

          <CardFooter className="mt-3 flex flex-wrap gap-1 border-t border-border/70 px-3 py-1.5">
            <div data-no-nav className="min-w-0 flex-1">
              <VoteControls
                score={score}
                viewerVote={viewerVote}
                pending={pending}
                layout="horizontal"
                onVote={applyVote}
              />
            </div>
            <Link
              href={postHref}
              data-no-nav
              className="inline-flex min-h-10 min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MessageCircleIcon className="size-4 shrink-0" aria-hidden />
              <span>
                {post.commentCount}{" "}
                {post.commentCount === 1
                  ? t("feed.comment")
                  : t("feed.comments")}
              </span>
            </Link>
            <button
              type="button"
              data-no-nav
              className="inline-flex min-h-10 min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("post.share")}
              onClick={sharePost}
            >
              <Share2Icon className="size-4 shrink-0" aria-hidden />
              <span>{t("post.share")}</span>
            </button>
            {offerTranslation ? (
              <button
                type="button"
                data-no-nav
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[color-mix(in_oklch,var(--flag-gold)_18%,transparent)]"
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
              <span className="w-full px-2 text-xs text-destructive" role="alert">
                {error}
              </span>
            ) : null}
          </CardFooter>
        </div>
      </Card>
    </article>
  );
}
