import { FileTextIcon, ImageIcon, Link2Icon } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/user/user-avatar";

type FeedComposerProps = {
  signedIn: boolean;
  username?: string | null;
  image?: string | null;
  title: string;
  prompt: string;
  textLabel: string;
  imageLabel: string;
  linkLabel: string;
};

const actionClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm";

export function FeedComposer({
  signedIn,
  username,
  image,
  title,
  prompt,
  textLabel,
  imageLabel,
  linkLabel,
}: FeedComposerProps) {
  const submitHref = signedIn ? "/submit" : "/login?next=%2Fsubmit";

  return (
    <section
      aria-label={title}
      data-testid="feed-composer"
      className="mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgb(0_0_0_/_8%)]"
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <UserAvatar
          username={username}
          image={image}
          size="md"
          alt={username ? `@${username}` : title}
        />
        <Link
          href={submitHref}
          className="flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-muted px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="truncate">{prompt}</span>
        </Link>
      </div>

      <div className="grid grid-cols-3 border-t border-border/70 px-1 py-1 sm:px-2">
        <Link href={submitHref} className={actionClass}>
          <FileTextIcon
            className="size-5 text-[var(--brand)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="truncate">{textLabel}</span>
        </Link>
        <Link href={submitHref} className={actionClass}>
          <ImageIcon
            className="size-5 text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="truncate">{imageLabel}</span>
        </Link>
        <Link href={submitHref} className={actionClass}>
          <Link2Icon
            className="size-5 text-[var(--flag-gold)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="truncate">{linkLabel}</span>
        </Link>
      </div>
    </section>
  );
}
