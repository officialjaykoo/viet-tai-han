import { NextRequest, NextResponse } from "next/server";

import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { unblockUser } from "@/lib/user-actions";

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
    return NextResponse.json(await unblockUser(session.user.id, userId));
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/me/blocks/[userId] failed", error);
    return await jsonLocalizedError("Action failed", 500);
  }
}
