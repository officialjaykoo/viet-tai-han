import { NextRequest, NextResponse } from "next/server";

import { broadcastChatMessage } from "@/lib/chat-realtime";
import { runBackgroundTask } from "@/lib/background-task";
import { getChatMessages, sendChatMessage } from "@/lib/messages";
import { CHAT_SLOW_REQUEST_MS, formatChatServerTiming } from "@/lib/chat-timing";

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
    const totalStartedAt = performance.now();
    const authStartedAt = performance.now();
    const session = await requireSession();
    const user = session.user as {
      id: string;
      name?: string;
      status?: string | null;
      username?: string | null;
      role?: string | null;
    };
    await requireActiveUser(user);
    const authMs = performance.now() - authStartedAt;
    const { roomId } = await context.params;
    const payload = await readApiJson(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return await jsonLocalizedError("body is required", 400);
    }
    const body = payload as {
      body?: unknown;
      clientMessageId?: unknown;
      requestId?: unknown;
    };
    if (typeof body.body !== "string" || body.body.trim().length === 0) {
      return await jsonLocalizedError("body is required", 400);
    }
    if (
      (body.clientMessageId !== undefined &&
        body.clientMessageId !== null &&
        typeof body.clientMessageId !== "string") ||
      (body.requestId !== undefined &&
        body.requestId !== null &&
        typeof body.requestId !== "string")
    ) {
      return await jsonLocalizedError("Invalid request ID", 400);
    }

    const message = await sendChatMessage({
      roomId,
      userId: user.id,
      body: body.body,
      userStatus: user.status,
      clientMessageId: body.clientMessageId,
      requestId: body.requestId ?? requestIdFromHeaders(request.headers),
    });

    const {
      created,
      shouldBroadcast,
      serverTiming,
      ...response
    } = message;
    if (created && shouldBroadcast) {
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

    const totalMs = performance.now() - totalStartedAt;
    const timing = {
      authMs,
      ...serverTiming,
      totalMs,
    };
    const result = NextResponse.json(response, { status: created ? 201 : 200 });
    result.headers.set("Server-Timing", formatChatServerTiming(timing));
    if (totalMs >= CHAT_SLOW_REQUEST_MS) {
      console.info(
        JSON.stringify({
          level: "info",
          msg: "chat_send_slow",
          roomId,
          messageId: message.id,
          ...timing,
        })
      );
    }
    return result;
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/[roomId] failed", error);
    return await jsonLocalizedError("Failed to send message", 500);
  }
}
