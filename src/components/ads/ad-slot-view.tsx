"use client";

import { TunneledOutboundLink } from "@/components/media/tunneled-outbound-link";

export type AdSlotData = {
  id: string;
  name: string;
  body: string | null;
  clickUrl: string;
};

/** Presentational shell for a server-selected sponsored slot (no /api/ads fetch). */
export function AdSlotView({ ad }: { ad: AdSlotData }) {
  return (
    <aside className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Sponsored
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
