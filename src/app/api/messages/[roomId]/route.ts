import { NextRequest, NextResponse } from "next/server";

import { broadcastChatMessage } from "@/lib/chat-realtime";
import { runBackgroundTask } from "@/lib/background-task";
import { getChatMessages, sendChatMessage } from "@/lib/messages";

import { requireActiveUser } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { requestIdFromHeaders } from "@/lib/idempotency";
import { readApiJson } from "@/lib/security/guard";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await requireSession();
    const { roomId } = await context.params;
    const before = request.nextUrl.searchParams.get("before");
    const after = request.nextUrl.searchParams.get("after");
    const rawLimit = request.nextUrl.searchParams.get("limit");
    if (before && after) {
      return await jsonLocalizedError(
        "Use only one chat history cursor",
        400
      );
    }
    let limit: number | undefined;
    if (rawLimit !== null) {
      if (!/^\d+$/.test(rawLimit)) {
        return await jsonLocalizedError("limit must be a number", 400);
      }
      limit = Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        return await jsonLocalizedError("limit must be between 1 and 100", 400);
      }
    }
    const page = await getChatMessages({
      roomId,
      userId: session.user.id,
      limit,
      before,
      after,
    });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/messages/[roomId] failed", error);
    return await jsonLocalizedError("Failed to load chat", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await requireSession();
    const user = session.user as {
      id: string;
      name?: string;
      status?: string | null;
      username?: string | null;
      role?: string | null;
    };
    await requireActiveUser(user);

    const { roomId } = await context.params;
    const body = (await readApiJson(request)) as {
      body?: string;
      clientMessageId?: string | null;
      requestId?: string | null;
    };
    if (!body.body) {
      return await jsonLocalizedError("body is required", 400);
    }

    const message = await sendChatMessage({
      roomId,
      userId: user.id,
      body: body.body,
      userStatus: user.status,
      clientMessageId: body.clientMessageId,
      requestId: body.requestId ?? requestIdFromHeaders(request.headers),
    });

    if (message.created && message.shouldBroadcast) {
      runBackgroundTask("chat_realtime_broadcast", () =>
        broadcastChatMessage({
          roomId,
          id: message.id,
          clientMessageId: message.clientMessageId,
          body: message.body,
          createdAt: message.createdAt,
          senderId: user.id,
          senderUsername: user.username ?? null,
        })
      );
    }

    const {
      created,
      shouldBroadcast: _shouldBroadcast,
      ...response
    } = message;
    void _shouldBroadcast;
    return NextResponse.json(response, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/[roomId] failed", error);
    return await jsonLocalizedError("Failed to send message", 500);
  }
}
