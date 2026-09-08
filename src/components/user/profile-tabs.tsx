"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { cn } from "@/lib/utils";

export type ProfileTab = "overview" | "posts" | "comments" | "friends";

const TABS: { id: ProfileTab; labelKey: MessageKey }[] = [
  { id: "overview", labelKey: "profile.overview" },
  { id: "posts", labelKey: "profile.posts" },
  { id: "comments", labelKey: "profile.comments" },
  { id: "friends", labelKey: "profile.friends" },
];

export function ProfileTabs({ current }: { current: ProfileTab }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  function hrefFor(tab: ProfileTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav
      aria-label={t("profile.sectionsAria")}
      className="flex overflow-x-auto border-b border-border"
    >
      {TABS.map((tab) => {
        const active = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-10 items-center px-3 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(tab.labelKey)}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
