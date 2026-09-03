"use client";

import { TunneledOutboundLink } from "@/components/media/tunneled-outbound-link";
import type { Locale } from "@/lib/i18n/config";
import { tLocale } from "@/lib/i18n/translate";

export type AdSlotData = {
  id: string;
  name: string;
  body: string | null;
  clickUrl: string;
};

/** Presentational shell for a server-selected sponsored slot (no /api/ads fetch). */
export function AdSlotView({
  ad,
  locale,
}: {
  ad: AdSlotData;
  locale: Locale;
}) {
  return (
    <aside className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {tLocale(locale, "feed.sponsored")}
      </p>
      <TunneledOutboundLink
        href={ad.clickUrl}
        className="mt-1 block font-medium hover:underline"
      >
        {ad.name}
      </TunneledOutboundLink>
      {ad.body ? (
        <p className="mt-1 text-muted-foreground">{ad.body}</p>
      ) : null}
    </aside>
  );
}
