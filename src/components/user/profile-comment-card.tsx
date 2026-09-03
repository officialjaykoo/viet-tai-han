import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { RelativeTime } from "@/components/time/relative-time";
import { SubredditLabel } from "@/components/posts/subreddit-label";
import { tLocale } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import type { ProfileComment } from "@/lib/content";
import { cn } from "@/lib/utils";

export function ProfileCommentCard({
  comment,
  locale,
  className,
}: {
  comment: ProfileComment;
  locale: Locale;
  className?: string;
}) {
  const href = `/post/${comment.postId}`;

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm",
        className
      )}
    >
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {tLocale(locale, "comments.comment")}
        </span>
        <span aria-hidden>·</span>
        <SubredditLabel name={comment.subreddit.name} />
        <span aria-hidden>·</span>
        <RelativeTime value={comment.createdAt} />
      </p>
      <Link
        href={href}
        className="mt-1 block text-sm font-medium text-muted-foreground hover:underline"
      >
        {comment.postTitle}
      </Link>
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
        {comment.body}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {tLocale(locale, "search.points", { count: comment.score })}
        </span>
        <Link
          href={href}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <MessageSquare className="size-3.5" aria-hidden />
          {tLocale(locale, "post.backToPost")}
        </Link>
      </div>
    </article>
  );
}
