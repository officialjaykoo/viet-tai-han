import { AdSlotView } from "@/components/ads/ad-slot-view";
import {
  pickAdForPlacement,
  recordAdImpression,
  type AdPlacement,
} from "@/lib/ads";
import { getSession } from "@/lib/session";

/**
 * Server-rendered ad slot. Selection + impression happen on the server so
 * ad blockers cannot snip a dedicated /api/ads client request.
 */
export async function AdSlot({
  placement,
}: {
  placement: AdPlacement;
}) {
  try {
    const campaign = await pickAdForPlacement(placement);
    if (!campaign) return null;

    const session = await getSession();
    void recordAdImpression({
      campaignId: campaign.id,
      viewerId: session?.user?.id ?? null,
      placement,
    }).catch(() => {
      // best-effort
    });

    return (
      <AdSlotView
        ad={{
          id: campaign.id,
          name: campaign.name,
          body: campaign.body,
          clickUrl: `/api/ads/${campaign.id}/click`,
        }}
      />
    );
  } catch {
    return null;
  }
}
