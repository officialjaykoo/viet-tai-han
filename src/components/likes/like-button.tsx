"use client";

import { HeartIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { LikeMutation } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LikeButton({
  likeCount,
  liked,
  pending,
  layout = "horizontal",
  onToggle,
}: {
  likeCount: number;
  liked: boolean;
  pending?: boolean;
  layout?: "vertical" | "horizontal";
  onToggle: (action: LikeMutation) => void;
}) {
  const { t } = useI18n();
  const vertical = layout === "vertical";

  return (
    <div
      className={cn(
        "flex items-center",
        vertical
          ? "w-12 shrink-0 flex-col gap-0 pt-0.5 sm:w-14"
          : "w-full min-w-0 flex-1 flex-row"
      )}
      role="group"
      aria-label={t("like.group")}
    >
      <Button
        type="button"
        variant="ghost"
        size={vertical ? "icon-sm" : "default"}
        aria-label={t("like.action")}
        aria-pressed={liked}
        disabled={pending}
        onClick={() => onToggle(liked ? "unlike" : "like")}
        className={cn(
          vertical
            ? "touch-target text-muted-foreground hover:text-[var(--brand)]"
            : "min-h-11 sm:min-h-9 min-w-0 flex-1 rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-[var(--brand)]",
          liked &&
            "bg-[color-mix(in_oklch,var(--flag-gold)_32%,transparent)] text-[var(--brand)]"
        )}
      >
        <HeartIcon className={cn("size-4", liked && "fill-current")} aria-hidden />
        {!vertical ? (
          <span className="truncate text-xs font-semibold leading-tight">
            {t("like.action")} {likeCount}
          </span>
        ) : (
          <span className="sr-only">
            {t("like.action")} {likeCount}
          </span>
        )}
      </Button>
    </div>
  );
}
