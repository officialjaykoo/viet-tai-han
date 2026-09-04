import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type FeedShortcut = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type FeedShortcutRailProps = {
  heading: string;
  links: FeedShortcut[];
};

export function FeedShortcutRail({
  heading,
  links,
}: FeedShortcutRailProps) {
  return (
    <section
      aria-label={heading}
      data-testid="feed-shortcuts"
      className="mb-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgb(0_0_0_/_8%)]"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        <Link
          href="/communities"
          aria-label={heading}
          className="text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          →
        </Link>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map(({ href, label, icon: Icon }, index) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex min-h-24 min-w-28 snap-start flex-1 flex-col justify-between rounded-xl border border-border/70 bg-background p-3 transition-colors hover:border-[var(--brand)]/40 hover:bg-accent sm:min-w-32",
              index === 0 && "border-[var(--brand)]/30 bg-[color-mix(in_oklch,var(--brand)_5%,var(--background))]"
            )}
          >
            <span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_oklch,var(--flag-gold)_24%,transparent)] text-[var(--brand)] transition-transform group-hover:scale-105">
              <Icon className="size-4" strokeWidth={1.9} aria-hidden />
            </span>
            <span className="mt-3 truncate text-xs font-semibold text-foreground">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
