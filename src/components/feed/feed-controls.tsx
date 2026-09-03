"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { FeedSort } from "@/lib/db";

export function FeedSortTabs({
  current,
  mode,
}: {
  current: FeedSort;
  mode?: "home" | "popular";
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sorts: { id: FeedSort; label: string }[] = [
    { id: "hot", label: t("feed.hot") },
    { id: "new", label: t("feed.new") },
    { id: "top", label: t("feed.top") },
  ];

  function hrefFor(sort: FeedSort) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    if (mode) params.set("feed", mode);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-1"
      role="tablist"
      aria-label={t("feed.sortLabel")}
    >
      {sorts.map((sort) => {
        const active = current === sort.id;
        return (
          <Link
            key={sort.id}
            href={hrefFor(sort.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex min-h-9 items-center rounded-4xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={(e) => {
              e.preventDefault();
              router.push(hrefFor(sort.id));
            }}
          >
            {sort.label}
          </Link>
        );
      })}
    </div>
  );
}

export function FeedModeTabs({
  current,
  signedIn,
}: {
  current: "home" | "popular";
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sort = searchParams.get("sort") ?? "hot";

  if (!signedIn) return null;

  function hrefFor(mode: "home" | "popular") {
    const params = new URLSearchParams();
    params.set("feed", mode);
    params.set("sort", sort);
    return `/?${params.toString()}`;
  }

  return (
    <div className="mb-3 flex gap-1" role="tablist" aria-label={t("feed.modeLabel")}>
      {(
        [
          { id: "popular" as const, label: t("feed.popular") },
          { id: "home" as const, label: t("nav.home") },
        ]
      ).map((tab) => {
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex min-h-9 items-center rounded-4xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            onClick={() => router.push(hrefFor(tab.id))}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
