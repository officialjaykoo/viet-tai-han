import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { serializeVoteResult } from "@/lib/serializers";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import type { VoteMutation } from "@/lib/types";
import { removeVoteOnPost, voteOnPost } from "@/lib/votes";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

const ACTIONS = new Set<VoteMutation>(["upvote", "downvote", "remove"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: postId } = await context.params;

    if (!postId) {
      return await jsonLocalizedError("Missing post id", 400);
    }

    const body = (await readApiJson(request)) as { action?: string };
    const action = body.action as VoteMutation | undefined;

    if (!action || !ACTIONS.has(action)) {
      return await jsonLocalizedError(
        "action must be 'upvote', 'downvote', or 'remove'",
        400
      );
    }

    const db = await getDb();
    const exists = await db
      .prepare(
        `SELECT id FROM posts WHERE id = ? AND is_removed = 0 AND is_shadow_hidden = 0`
      )
      .bind(postId)
      .first<{ id: string }>();

    if (!exists) {
      return await jsonLocalizedError("Post not found", 404);
    }

    const user = session.user as {
      id: string;
      karma?: number | null;
      status?: string | null;
    };

    const result =
      action === "remove"
        ? await removeVoteOnPost(postId, {
            userId: user.id,
            voterKarma: user.karma ?? 0,
            userStatus: user.status,
          })
        : await voteOnPost(postId, action, {
            userId: user.id,
            voterKarma: user.karma ?? 0,
            userStatus: user.status,
          });

    return NextResponse.json(serializeVoteResult(result));
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/posts/[id]/vote failed", error);
    return await jsonLocalizedError("Failed to apply vote", 500);
  }
}
