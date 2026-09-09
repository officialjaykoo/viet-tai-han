import { NextRequest, NextResponse } from "next/server";

import { markChatMessagesRead } from "@/lib/messages";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await requireSession();
    const { roomId } = await context.params;
    const payload = await readApiJson(request);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      typeof (payload as { messageId?: unknown }).messageId !== "string" ||
      (payload as { messageId: string }).messageId.trim().length === 0
    ) {
      return await jsonLocalizedError("messageId is required", 400);
    }
    const body = payload as { messageId: string };
    const result = await markChatMessagesRead({
      roomId,
      userId: session.user.id,
      messageId: body.messageId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/[roomId]/read failed", error);
    return await jsonLocalizedError("Failed to mark chat as read", 500);
  }
}
