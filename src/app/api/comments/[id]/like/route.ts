import { NextRequest, NextResponse } from "next/server";

import { likeComment, unlikeComment } from "@/lib/likes";
import { parseLikePayload } from "@/lib/content-payload";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { serializeCommentLikeResult } from "@/lib/serializers";


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: commentId } = await context.params;
    const body = parseLikePayload(await readApiJson(request));
    const action = body.action;

    if (!commentId) {
      return await jsonLocalizedError("Missing comment id", 400);
    }

    const user = session.user as { id: string };
    const result =
      action === "like"
        ? await likeComment(commentId, user.id)
        : await unlikeComment(commentId, user.id);

    return NextResponse.json(serializeCommentLikeResult(result));
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/comments/[id]/like failed", error);
    return await jsonLocalizedError("Failed to apply like", 500);
  }
}
