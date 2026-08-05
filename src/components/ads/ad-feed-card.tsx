"use client";

import { ExternalLink } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { TunneledOutboundLink } from "@/components/media/tunneled-outbound-link";
import { PostMedia } from "@/components/posts/post-media";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserAvatar } from "@/components/user/user-avatar";
import type { FeedAdItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Feed-native sponsored card — same shell as PostCard so it rides in the
 * posts array (no separate /api/ads fetch for ad blockers to snip).
 */
export function AdFeedCard({ ad }: { ad: FeedAdItem }) {
  const { t } = useI18n();

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
          {/* Decorative score column — mirrors organic posts */}
          <div
            className="flex w-10 shrink-0 flex-col items-center gap-0.5 pt-3 text-xs text-muted-foreground sm:w-12"
            aria-hidden
          >
            <span className="text-[10px] leading-none">▲</span>
            <span className="tabular-nums font-medium">·</span>
            <span className="text-[10px] leading-none">▼</span>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <CardHeader className="gap-1 px-3 pt-3 pb-0">
              <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-anywhere text-xs text-muted-foreground">
                <UserAvatar
                  username="promoted"
                  image={null}
                  size="xs"
                  className="ring-0"
                />
                <span className="font-medium text-foreground">
                  {t("feed.promoted")}
                </span>
                <span aria-hidden>·</span>
                <span>{t("feed.sponsored")}</span>
              </p>
              <CardTitle className="font-heading break-anywhere text-base leading-snug font-semibold tracking-tight text-balance sm:text-[1.05rem]">
                <TunneledOutboundLink
                  href={ad.clickUrl}
                  className="hover:underline"
                >
                  {ad.title}
                </TunneledOutboundLink>
              </CardTitle>
            </CardHeader>

            {ad.body ? (
              <CardContent className="px-3 pt-2 pb-0">
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {ad.body}
                </p>
              </CardContent>
            ) : null}

            {ad.mediaKey ? (
              <CardContent className="px-3 pt-2 pb-0">
                <TunneledOutboundLink href={ad.clickUrl} className="block">
                  <PostMedia
                    mediaKey={ad.mediaKey}
                    alt={ad.title}
                    className="max-h-80"
                  />
                </TunneledOutboundLink>
              </CardContent>
            ) : null}

            <CardFooter className="flex-wrap gap-3 px-3 pt-3 pb-3">
              <TunneledOutboundLink
                href={ad.clickUrl}
                className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                {t("feed.learnMore")}
              </TunneledOutboundLink>
            </CardFooter>
          </div>
        </div>
      </Card>
    </article>
  );
}
