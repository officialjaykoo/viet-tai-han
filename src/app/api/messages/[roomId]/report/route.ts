import { NextRequest, NextResponse } from "next/server";

import { reportChatMessage } from "@/lib/dm-moderation";
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
    const body = (await readApiJson(request).catch(() => null)) as {
      messageId?: unknown;
      reason?: unknown;
      details?: unknown;
    } | null;
    if (typeof body?.messageId !== "string" || typeof body.reason !== "string") {
      return await jsonLocalizedError("messageId and reason are required", 400);
    }
    const result = await reportChatMessage({
      roomId,
      messageId: body.messageId,
      reporterId: session.user.id,
      reason: body.reason,
      details: typeof body.details === "string" ? body.details : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/[roomId]/report failed", error);
    return await jsonLocalizedError("Failed to report message", 500);
  }
}
