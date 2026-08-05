"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { AccountTag, AccountTagId } from "@/lib/tags";
import { cn } from "@/lib/utils";

const TAG_STYLES: Record<AccountTagId, string> = {
  admin:
    "bg-[color-mix(in_oklch,var(--brand)_18%,transparent)] text-[var(--brand)] ring-[color-mix(in_oklch,var(--brand)_35%,transparent)]",
  moderator:
    "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  veteran:
    "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-200",
  nsfw: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
};

const TAG_KEYS: Record<AccountTagId, MessageKey> = {
  admin: "tags.admin",
  moderator: "tags.moderator",
  veteran: "tags.veteran",
  nsfw: "tags.nsfw",
};

export function AccountTags({
  tags,
  className,
  size = "sm",
}: {
  tags: AccountTag[];
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  if (!tags.length) return null;

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
    >
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            "inline-flex items-center rounded-md font-semibold uppercase tracking-wide ring-1 ring-inset",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
            TAG_STYLES[tag.id]
          )}
        >
          {t(TAG_KEYS[tag.id])}
        </span>
      ))}
    </span>
  );
}
