import { NextRequest, NextResponse } from "next/server";

import { getChatMessages, sendChatMessage } from "@/lib/messages";
import { requireCanMessage } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await requireSession();
    const { roomId } = await context.params;
    const messages = await getChatMessages({
      roomId,
      userId: session.user.id,
    });
    return NextResponse.json({ messages });
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
      email?: string;
      status?: string | null;
      karma?: number | null;
      username?: string | null;
      role?: string | null;
    };
    await requireCanMessage({
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      status: user.status,
      karma: user.karma,
      username: user.username,
      role: user.role,
    });

    const { roomId } = await context.params;
    const body = (await readApiJson(request)) as { body?: string };
    if (!body.body) {
      return await jsonLocalizedError("body is required", 400);
    }

    const message = await sendChatMessage({
      roomId,
      userId: user.id,
      body: body.body,
      userStatus: user.status,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages/[roomId] failed", error);
    return await jsonLocalizedError("Failed to send message", 500);
  }
}
