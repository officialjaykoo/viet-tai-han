import { NextRequest, NextResponse } from "next/server";

import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  removeFriend,
} from "@/lib/friends";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession();
    const [friends, incoming, outgoing] = await Promise.all([
      listFriends(session.user.id),
      listIncomingFriendRequests(session.user.id),
      listOutgoingFriendRequests(session.user.id),
    ]);
    return NextResponse.json({ friends, incoming, outgoing });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/friends failed", error);
    return await jsonLocalizedError("Failed to load friends", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => ({}))) as {
      action?: "accept" | "decline" | "cancel" | "remove";
      requestId?: string;
      userId?: string;
    };

    switch (body.action) {
      case "accept":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return NextResponse.json(
          await acceptFriendRequest(session.user.id, body.requestId)
        );
      case "decline":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return NextResponse.json(
          await declineFriendRequest(session.user.id, body.requestId)
        );
      case "cancel":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return NextResponse.json(
          await cancelFriendRequest(session.user.id, body.requestId)
        );
      case "remove":
        if (!body.userId) {
          return await jsonLocalizedError("userId is required", 400);
        }
        return NextResponse.json(
          await removeFriend(session.user.id, body.userId)
        );
      default:
        return await jsonLocalizedError("Unknown action", 400);
    }
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/friends failed", error);
    return await jsonLocalizedError("Friend action failed", 500);
  }
}
