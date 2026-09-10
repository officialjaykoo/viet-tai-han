import { NextResponse } from "next/server";

import { getRecommendations } from "@/lib/content";
import { serializeFeed } from "@/lib/serializers";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET() {
  try {
    const session = await requireSession();
    const posts = await getRecommendations(session.user.id, 20);
    return NextResponse.json(
      serializeFeed(
        {
          posts: posts.map((post) => ({ ...post, kind: "post" as const })),
          nextCursor: null,
          hasMore: false,
        },
        session.user.id
      )
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("GET /api/recommendations failed", error);
    return await jsonLocalizedError("Failed to load recommendations", 500);
  }
}
