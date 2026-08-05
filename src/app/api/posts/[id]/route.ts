import { NextRequest, NextResponse } from "next/server";

import { editPost, softDeletePost } from "@/lib/actions";
import { getPostDetail } from "@/lib/content";
import { getDb } from "@/lib/db";
import { requireModeratorOrAdmin, type SessionUser } from "@/lib/permissions";
import { serializePostDetail } from "@/lib/serializers";
import {
  AuthError,
  getSession,
  jsonAuthError,
  requireSession,
} from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson, requireSignedApiRequest } from "@/lib/security/guard";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const viewerUserId = session?.user?.id ?? null;
    const post = await getPostDetail(id, viewerUserId);
    if (!post) {
      return await jsonLocalizedError("Post not found", 404);
    }
    return NextResponse.json(serializePostDetail(post, viewerUserId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("GET /api/posts/[id] failed", error);
    return await jsonLocalizedError("Failed to load post", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as {
      title?: string;
      body?: string | null;
      url?: string | null;
    };

    const result = await editPost({
      postId: id,
      userId: session.user.id,
      title: body.title,
      body: body.body,
      url: body.url,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("PATCH /api/posts/[id] failed", error);
    return await jsonLocalizedError("Failed to edit post", 500);
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
    const post = await db
      .prepare(`SELECT author_id, subreddit_id FROM posts WHERE id = ?`)
      .bind(id)
      .first<{ author_id: string; subreddit_id: string }>();

    if (!post) {
      return await jsonLocalizedError("Post not found", 404);
    }

    const user = session.user as SessionUser;
    if (post.author_id !== user.id) {
      await requireModeratorOrAdmin(user, post.subreddit_id);
    }

    await softDeletePost(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("DELETE /api/posts/[id] failed", error);
    return await jsonLocalizedError("Failed to delete post", 500);
  }
}
