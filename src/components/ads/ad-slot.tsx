import { AdSlotView } from "@/components/ads/ad-slot-view";
import {
  pickAdForPlacement,
  recordAdImpression,
  type AdCampaign,
  type AdPlacement,
} from "@/lib/ads";
import { getSession } from "@/lib/session";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import { getMonetizationContext } from "@/lib/monetization";

/**
 * Server-rendered ad slot. Selection + impression happen on the server so
 * ad blockers cannot snip a dedicated /api/ads client request.
 */
export async function AdSlot({
  placement,
}: {
  placement: AdPlacement;
}) {
  let slot: { locale: Locale; campaign: AdCampaign } | null = null;
  try {
    const { locale } = await getRequestLocale();
    const session = await getSession();
    const monetization = await getMonetizationContext(
      session?.user?.id ?? null
    );
    if (monetization.isPro) return null;

    const campaign = await pickAdForPlacement(placement);
    if (!campaign) return null;

    if (monetization.analyticsAllowed) {
      void recordAdImpression({
        campaignId: campaign.id,
        viewerId: session?.user?.id ?? null,
        placement,
      }).catch(() => {
        // best-effort
      });
    }
    slot = { locale, campaign };
  } catch {
    return null;
  }

  if (!slot) return null;
  return (
    <AdSlotView
      ad={{
        id: slot.campaign.id,
        name: slot.campaign.name,
        body: slot.campaign.body,
        clickUrl: `/api/ads/${slot.campaign.id}/click`,
      }}
      locale={slot.locale}
    />
  );
}
