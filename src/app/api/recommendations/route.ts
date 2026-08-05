import { NextRequest, NextResponse } from "next/server";

import { withFeedAds } from "@/lib/ads";
import { getRecommendations } from "@/lib/content";
import { clientIpFromHeaders } from "@/lib/security/challenge";
import { enforceExpensiveIpRateLimit } from "@/lib/rate-limit";
import { serializeFeed } from "@/lib/serializers";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    await enforceExpensiveIpRateLimit(ip, "recommend:burst");
    const session = await requireSession();
    const posts = await getRecommendations(session.user.id, 20);
    const feed = await withFeedAds(
      { posts, nextCursor: null, hasMore: false },
      session.user.id
    );
    return NextResponse.json(serializeFeed(feed, session.user.id));
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("GET /api/recommendations failed", error);
    return await jsonLocalizedError("Failed to load recommendations", 500);
  }
}
