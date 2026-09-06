"use client";

import { HeartIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { VoteMutation, ViewerVote } from "@/lib/types";
import { cn } from "@/lib/utils";


export function VoteControls({
  likeCount,
  viewerVote,
  pending,
  layout = "horizontal",
  onVote,
}: {
  likeCount: number;
  viewerVote: ViewerVote;
  pending?: boolean;
  layout?: "vertical" | "horizontal";
  onVote: (action: VoteMutation) => void;
}) {
  const { t } = useI18n();
  const vertical = layout === "vertical";
  const liked = viewerVote === "upvote";

  return (
    <div
      className={cn(
        "flex items-center",
        vertical
          ? "w-12 shrink-0 flex-col gap-0 pt-0.5 sm:w-14"
          : "w-full min-w-0 flex-1 flex-row"
      )}
      role="group"
      aria-label={t("vote.group")}
    >
      <Button
        type="button"
        variant="ghost"
        size={vertical ? "icon-sm" : "default"}
        aria-label={t("vote.like")}
        aria-pressed={liked}
        disabled={pending}
        onClick={() => onVote(liked ? "remove" : "upvote")}
        className={cn(
          vertical
            ? "touch-target text-muted-foreground hover:text-[var(--brand)]"
            : "min-h-10 min-w-0 flex-1 rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-[var(--brand)]",
          liked &&
            "bg-[color-mix(in_oklch,var(--flag-gold)_32%,transparent)] text-[var(--brand)]"
        )}
      >
        <HeartIcon className={cn("size-5", liked && "fill-current")} aria-hidden />
        {!vertical ? (
          <span className="truncate text-xs font-semibold">
            {t("vote.like")} {likeCount}
          </span>
        ) : (
          <span className="sr-only">
            {t("vote.like")} {likeCount}
          </span>
        )}
      </Button>
    </div>
  );
}
