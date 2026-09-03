"use client";

import { ArrowBigDown, ArrowBigUp } from "lucide-react";

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
        "flex items-center gap-0",
        vertical
          ? "w-12 shrink-0 flex-col pt-0.5 sm:w-14"
          : "flex-row"
      )}
      role="group"
      aria-label={t("vote.group")}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("vote.upvote")}
        aria-pressed={viewerVote === "upvote"}
        disabled={pending}
        onClick={() => onVote("upvote")}
        className={cn(
          "touch-target text-muted-foreground hover:text-[var(--brand)]",
          viewerVote === "upvote" && "text-[var(--brand)]"
        )}
      >
        <ArrowBigUp className="size-5" aria-hidden />
      </Button>
      <span
        className={cn(
          "font-heading text-xs font-semibold tabular-nums",
          score > 0 && "text-foreground",
          score < 0 && "text-muted-foreground",
          !vertical && "px-1"
        )}
      >
        {formatScore(score)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("vote.downvote")}
        aria-pressed={viewerVote === "downvote"}
        disabled={pending}
        onClick={() => onVote("downvote")}
        className={cn(
          "touch-target text-muted-foreground hover:text-sky-600",
          viewerVote === "downvote" && "text-sky-600"
        )}
      >
        <ArrowBigDown className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
