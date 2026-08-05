import { describe, expect, it } from "vitest";

import { campaignToFeedAd, type AdCampaign } from "@/lib/ads";

function sample(over: Partial<AdCampaign> = {}): AdCampaign {
  return {
    id: "camp_1",
    name: "Try Workers",
    status: "active",
    placement: "feed_inline",
    body: "Deploy at the edge.",
    imageKey: null,
    targetUrl: "https://example.com",
    weight: 1,
    startsAt: null,
    endsAt: null,
    createdBy: "user_alice",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("feed ad embedding", () => {
  it("maps a campaign into a feed-native ad item", () => {
    const ad = campaignToFeedAd(sample(), "0");
    expect(ad.kind).toBe("ad");
    expect(ad.id).toBe("ad_camp_1_0");
    expect(ad.campaignId).toBe("camp_1");
    expect(ad.title).toBe("Try Workers");
    expect(ad.clickUrl).toBe("/api/ads/camp_1/click");
    expect(ad.placement).toBe("feed_inline");
  });
});
