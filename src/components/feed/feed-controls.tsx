"use client";

import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function FeedModeTabs({
  current,
  signedIn,
}: {
  current: "home" | "popular";
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const sort = "new";

  if (!signedIn) return null;

  function hrefFor(mode: "home" | "popular") {
    const params = new URLSearchParams();
    params.set("feed", mode);
    params.set("sort", sort);
    return `/?${params.toString()}`;
  }

  return (
    <div
      className="mb-1 flex gap-1 border-b border-border/70"
      role="tablist"
      aria-label={t("feed.modeLabel")}
    >
      {[
        { id: "popular" as const, label: t("feed.popular") },
        { id: "home" as const, label: t("nav.home") },
      ].map((tab) => {
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "relative inline-flex min-h-10 items-center rounded-t-lg border-b-2 border-transparent px-3 text-sm font-semibold transition-colors hover:bg-muted/70",
              active
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "text-muted-foreground"
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

