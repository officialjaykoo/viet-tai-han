import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { jsonLocalizedError } from "@/lib/public-error";
import { getProfileRelation, blockUser } from "@/lib/user-actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const db = await getDb();
    const post = await db
      .prepare(`SELECT author_id FROM posts WHERE id = ? AND is_removed = 0`)
      .bind(id)
      .first<{ author_id: string }>();
    if (!post) return await jsonLocalizedError("Post not found", 404);

    const result = await blockUser(session.user.id, post.author_id);
    return NextResponse.json({
      ...result,
      relationship: await getProfileRelation(session.user.id, post.author_id),
    });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/posts/[id]/block-author failed", error);
    return await jsonLocalizedError("Action failed", 500);
  }
}
