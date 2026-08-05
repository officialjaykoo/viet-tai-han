import { NextRequest, NextResponse } from "next/server";

import { getPostAnalytics } from "@/lib/post-analytics";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
    const range =
      rangeParam === "30d" || rangeParam === "all" ? rangeParam : "7d";

    const stats = await getPostAnalytics({
      postId: id,
      authorId: session.user.id,
      range,
    });
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/posts/[id]/stats failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
