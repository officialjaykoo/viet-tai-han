import { NextRequest, NextResponse } from "next/server";

import { editComment, softDeleteComment } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { requireModeratorOrAdmin, type SessionUser } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson, requireSignedApiRequest } from "@/lib/security/guard";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as { body?: string };
    if (!body.body?.trim()) {
      return await jsonLocalizedError("body is required", 400);
    }

    const result = await editComment({
      commentId: id,
      userId: session.user.id,
      body: body.body,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("PATCH /api/comments/[id] failed", error);
    return await jsonLocalizedError("Failed to edit comment", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSignedApiRequest(request, "DELETE");
    const session = await requireSession();
    const { id } = await context.params;
    const db = await getDb();
    const comment = await db
      .prepare(
        `SELECT c.author_id, p.subreddit_id
         FROM comments c
         INNER JOIN posts p ON p.id = c.post_id
         WHERE c.id = ?`
      )
      .bind(id)
      .first<{ author_id: string; subreddit_id: string }>();

    if (!comment) {
      return await jsonLocalizedError("Comment not found", 404);
    }

    const user = session.user as SessionUser;
    if (comment.author_id !== user.id) {
      await requireModeratorOrAdmin(user, comment.subreddit_id);
    }

    await softDeleteComment(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("DELETE /api/comments/[id] failed", error);
    return await jsonLocalizedError("Failed to delete comment", 500);
  }
}
