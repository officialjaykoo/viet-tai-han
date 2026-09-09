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
import { getDb } from "@/lib/db";
import { getProfileRelation } from "@/lib/user-actions";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { parseFriendActionPayload } from "@/lib/relationship-payload";
import { readApiJson } from "@/lib/security/guard";

async function resolveRelationshipTarget(
  viewerId: string,
  input: { requestId?: string; userId?: string }
) {
  if (input.userId) return input.userId;
  if (!input.requestId) return null;
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT requester_id, addressee_id
       FROM user_friendships
       WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`
    )
    .bind(input.requestId, viewerId, viewerId)
    .first<{ requester_id: string; addressee_id: string }>();
  if (!row) return null;
  return row.requester_id === viewerId ? row.addressee_id : row.requester_id;
}

async function relationResponse<T extends object>(
  result: T,
  viewerId: string,
  targetUserId: string | null
) {
  return NextResponse.json({
    ...result,
    relationship: targetUserId
      ? await getProfileRelation(viewerId, targetUserId)
      : null,
  });
}

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
    const body = parseFriendActionPayload(await readApiJson(request));

    const targetUserId = await resolveRelationshipTarget(session.user.id, body);
    switch (body.action) {
      case "accept":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return relationResponse(
          await acceptFriendRequest(session.user.id, body.requestId),
          session.user.id,
          targetUserId
        );
      case "decline":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return relationResponse(
          await declineFriendRequest(session.user.id, body.requestId),
          session.user.id,
          targetUserId
        );
      case "cancel":
        if (!body.requestId) {
          return await jsonLocalizedError("requestId is required", 400);
        }
        return relationResponse(
          await cancelFriendRequest(session.user.id, body.requestId),
          session.user.id,
          targetUserId
        );
      case "remove":
        if (!body.userId) {
          return await jsonLocalizedError("userId is required", 400);
        }
        return relationResponse(
          await removeFriend(session.user.id, body.userId),
          session.user.id,
          targetUserId
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
