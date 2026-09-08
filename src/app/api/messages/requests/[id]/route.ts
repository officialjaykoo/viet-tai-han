import { NextRequest, NextResponse } from "next/server";

import { cancelChatRequest, respondToChatRequest } from "@/lib/messages";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as { action?: string };
    if (
      body.action !== "accept" &&
      body.action !== "decline" &&
      body.action !== "cancel"
    ) {
      return await jsonLocalizedError(
        "action must be accept, decline, or cancel",
        400
      );
    }

    const result =
      body.action === "cancel"
        ? await cancelChatRequest({
            requestId: id,
            userId: session.user.id,
          })
        : await respondToChatRequest({
            requestId: id,
            userId: session.user.id,
            accept: body.action === "accept",
          });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/requests/[id] failed", error);
    return await jsonLocalizedError("Failed to update request", 500);
  }
}
