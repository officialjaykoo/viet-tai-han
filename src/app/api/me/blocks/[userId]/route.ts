import { NextRequest, NextResponse } from "next/server";

import { getProfileRelation, blockUser, unblockUser } from "@/lib/user-actions";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

async function relationResponse(
  result: { blocked: boolean },
  viewerId: string,
  targetUserId: string
) {
  return NextResponse.json({
    ...result,
    relationship: await getProfileRelation(viewerId, targetUserId),
  });
}
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireSession();
    const { userId } = await context.params;
    if (!userId || userId.length > 128) {
      return await jsonLocalizedError("User not found", 404);
    }
    return relationResponse(
      await blockUser(session.user.id, userId),
      session.user.id,
      userId
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/me/blocks/[userId] failed", error);
    return await jsonLocalizedError("Action failed", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireSession();
    const { userId } = await context.params;
    if (!userId || userId.length > 128) {
      return await jsonLocalizedError("User not found", 404);
    }
    return relationResponse(
      await unblockUser(session.user.id, userId),
      session.user.id,
      userId
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/me/blocks/[userId] failed", error);
    return await jsonLocalizedError("Action failed", 500);
  }
}
