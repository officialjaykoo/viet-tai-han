import { NextRequest, NextResponse } from "next/server";

import {
  listChatRooms,
  listIncomingRequests,
  startChatRequest,
} from "@/lib/messages";
import { requireCanMessage } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
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
      karma?: number | null;
      username?: string | null;
      role?: string | null;
    };
    await requireCanMessage({
      id: user.id,
      name: user.name ?? "",
      status: user.status,
      karma: user.karma,
      username: user.username,
      role: user.role,
    });

    const body = (await readApiJson(request)) as {
      toUsername?: string;
      body?: string;
    };
    if (!body.toUsername || !body.body) {
      return await jsonLocalizedError("toUsername and body are required", 400);
    }

    const result = await startChatRequest({
      fromUserId: user.id,
      toUsername: body.toUsername,
      openerBody: body.body,
      fromStatus: user.status,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/messages failed", error);
    return await jsonLocalizedError("Failed to start chat", 500);
  }
}
