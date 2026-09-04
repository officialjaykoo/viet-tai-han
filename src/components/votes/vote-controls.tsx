"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { VoteAction, ViewerVote } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatScore(score: number): string {
  if (Math.abs(score) >= 1000) {
    return `${(score / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(score);
}

export function VoteControls({
  score,
  viewerVote,
  pending,
  layout = "vertical",
  onVote,
}: {
  score: number;
  viewerVote: ViewerVote;
  pending?: boolean;
  layout?: "vertical" | "horizontal";
  onVote: (action: VoteAction) => void;
}) {
  const { t } = useI18n();
  const vertical = layout === "vertical";

  return (
    <div
      className={cn(
        "flex items-center",
        vertical
          ? "w-12 shrink-0 flex-col gap-0 pt-0.5 sm:w-14"
          : "w-full min-w-0 flex-1 flex-row gap-1"
      )}
      role="group"
      aria-label={t("vote.group")}
    >
      <Button
        type="button"
        variant="ghost"
        size={vertical ? "icon-sm" : "default"}
        aria-label={t("vote.upvote")}
        aria-pressed={viewerVote === "upvote"}
        disabled={pending}
        onClick={() => onVote("upvote")}
        className={cn(
          vertical
            ? "touch-target text-muted-foreground hover:text-[var(--brand)]"
            : "min-h-10 min-w-0 flex-1 rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-[var(--brand)]",
          viewerVote === "upvote" &&
            "bg-[color-mix(in_oklch,var(--flag-gold)_32%,transparent)] text-[var(--brand)]"
        )}
      >
        <ThumbsUpIcon className="size-5" aria-hidden />
        {!vertical ? (
          <span className="truncate text-xs font-semibold">
            {t("vote.upvote")}
          </span>
        ) : null}
      </Button>
      <span
        className={cn(
          "font-heading text-xs font-semibold tabular-nums",
          score > 0 && "text-foreground",
          score < 0 && "text-muted-foreground",
          !vertical && "min-w-8 px-1 text-center"
        )}
      >
        {formatScore(score)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={vertical ? "icon-sm" : "default"}
        aria-label={t("vote.downvote")}
        aria-pressed={viewerVote === "downvote"}
        disabled={pending}
        onClick={() => onVote("downvote")}
        className={cn(
          vertical
            ? "touch-target text-muted-foreground hover:text-[var(--brand)]"
            : "min-h-10 min-w-0 flex-1 rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-[var(--brand)]",
          viewerVote === "downvote" &&
            "bg-[color-mix(in_oklch,var(--flag-gold)_32%,transparent)] text-[var(--brand)]"
        )}
      >
        <ThumbsDownIcon className="size-5" aria-hidden />
        {!vertical ? (
          <span className="truncate text-xs font-semibold">
            {t("vote.downvote")}
          </span>
        ) : null}
      </Button>
    </div>
  );
}
