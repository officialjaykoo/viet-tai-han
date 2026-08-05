import { NextRequest, NextResponse } from "next/server";

import { voteOnComment } from "@/lib/actions";
import { serializeCommentVoteResult } from "@/lib/serializers";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import type { VoteAction } from "@/lib/types";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

const ACTIONS = new Set<VoteAction>(["upvote", "downvote"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: commentId } = await context.params;
    const body = (await readApiJson(request)) as { action?: string };
    const action = body.action as VoteAction | undefined;

    if (!action || !ACTIONS.has(action)) {
      return await jsonLocalizedError("action must be 'upvote' or 'downvote'", 400);
    }

    const user = session.user as {
      id: string;
      karma?: number | null;
      status?: string | null;
    };
    const result = await voteOnComment({
      commentId,
      userId: user.id,
      voterKarma: user.karma ?? 0,
      userStatus: user.status,
      action,
    });

    return NextResponse.json(serializeCommentVoteResult(result));
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/comments/[id]/vote failed", error);
    return await jsonLocalizedError("Failed to vote on comment", 500);
  }
}
