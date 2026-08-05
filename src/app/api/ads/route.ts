import { NextRequest, NextResponse } from "next/server";

import { pickAdForPlacement, type AdPlacement } from "@/lib/ads";
import { jsonLocalizedError } from "@/lib/public-error";

const PLACEMENTS = new Set<AdPlacement>([
  "feed_inline",
  "sidebar",
  "post_footer",
]);

export async function GET(request: NextRequest) {
  try {
    const placement = (request.nextUrl.searchParams.get("placement") ??
      "feed_inline") as AdPlacement;
    if (!PLACEMENTS.has(placement)) {
      return await jsonLocalizedError("Invalid placement", 400);
    }
    const ad = await pickAdForPlacement(placement);
    if (!ad) {
      return NextResponse.json({ ad: null });
    }
    return NextResponse.json({
      ad: {
        id: ad.id,
        name: ad.name,
        body: ad.body,
        imageKey: ad.imageKey,
        placement: ad.placement,
        clickUrl: `/api/ads/${ad.id}/click`,
      },
    });
  } catch (error) {
    console.error("GET /api/ads failed", error);
    return await jsonLocalizedError("Failed to load ad", 500);
  }
}
