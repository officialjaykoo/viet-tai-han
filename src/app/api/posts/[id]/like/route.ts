import { NextRequest, NextResponse } from "next/server";

import { likePost, unlikePost } from "@/lib/likes";
import { parseLikePayload } from "@/lib/content-payload";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { serializeLikeResult } from "@/lib/serializers";


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: postId } = await context.params;
    const body = parseLikePayload(await readApiJson(request));
    const action = body.action;

    if (!postId) {
      return await jsonLocalizedError("Missing post id", 400);
    }

    const user = session.user as { id: string };
    const result =
      action === "like"
        ? await likePost(postId, user.id)
        : await unlikePost(postId, user.id);

    return NextResponse.json(serializeLikeResult(result));
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/posts/[id]/like failed", error);
    return await jsonLocalizedError("Failed to apply like", 500);
  }
}
