import { NextRequest, NextResponse } from "next/server";

import { broadcastChatMessage } from "@/lib/chat-realtime";
import { runBackgroundTask } from "@/lib/background-task";
import {
  listChatRooms,
  listIncomingRequests,
  startConversation,
} from "@/lib/messages";
import { requireActiveUser } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { requestIdFromHeaders } from "@/lib/idempotency";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const [rooms, requests] = await Promise.all([
      listChatRooms(userId),
      listIncomingRequests(userId),
    ]);
    return NextResponse.json({ rooms, requests });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/messages failed", error);
    return await jsonLocalizedError("Failed to load messages", 500);
  }
}

export async function POST(request: NextRequest) {
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

    const body = (await readApiJson(request)) as {
      toUsername?: string;
      body?: string;
      clientMessageId?: string | null;
      requestId?: string | null;
    };
    if (!body.toUsername || !body.body) {
      return await jsonLocalizedError("toUsername and body are required", 400);
    }

    const result = await startConversation({
      fromUserId: user.id,
      toUsername: body.toUsername,
      openerBody: body.body,
      fromStatus: user.status,
      clientMessageId: body.clientMessageId,
      requestId: body.requestId ?? requestIdFromHeaders(request.headers),
    });

    if (
      result.conversationType === "direct" &&
      result.created &&
      result.messageId &&
      result.messageBody &&
      result.messageCreatedAt
    ) {
      runBackgroundTask("chat_realtime_broadcast", () =>
        broadcastChatMessage({
          roomId: result.roomId,
          id: result.messageId,
          clientMessageId: result.clientMessageId,
          body: result.messageBody,
          createdAt: result.messageCreatedAt,
          senderId: user.id,
          senderUsername: user.username ?? null,
        })
      );
    }

    const response =
      result.conversationType === "direct"
        ? {
            conversationType: result.conversationType,
            requestId: result.requestId,
            roomId: result.roomId,
            toUsername: result.toUsername,
            messageId: result.messageId,
            clientMessageId: result.clientMessageId,
          }
        : {
            conversationType: result.conversationType,
            requestId: result.requestId,
            roomId: result.roomId,
            toUsername: result.toUsername,
            clientMessageId: result.clientMessageId,
          };
    return NextResponse.json(response, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages failed", error);
    return await jsonLocalizedError("Failed to start chat", 500);
  }
}
