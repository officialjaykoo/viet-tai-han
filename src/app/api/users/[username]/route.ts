import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  cancelFriendRequestByUsers,
  sendFriendRequest,
} from "@/lib/friends";
import {
  followUser,
  getProfileRelation,
  muteUser,
  reportTarget,
  unfollowUser,
  unmuteUser,
} from "@/lib/user-actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { parseUserActionPayload } from "@/lib/relationship-payload";
import { readApiJson } from "@/lib/security/guard";
async function resolveUserId(username: string) {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id FROM "user"
       WHERE username = ? COLLATE NOCASE OR id = ?`
    )
    .bind(username, username)
    .first<{ id: string }>();
}

async function relationResponse<T extends object>(
  result: T,
  viewerId: string,
  targetUserId: string,
  status = 200
) {
  return NextResponse.json(
    {
      ...result,
      relationship: await getProfileRelation(viewerId, targetUserId),
    },
    { status }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const session = await requireSession();
    const { username } = await context.params;
    const user = await resolveUserId(username);
    if (!user) {
      return await jsonLocalizedError("User not found", 404);
    }

    const body = parseUserActionPayload(await readApiJson(request));

    switch (body.action) {
      case "follow":
        return relationResponse(
          await followUser(session.user.id, user.id),
          session.user.id,
          user.id
        );
      case "unfollow":
        return relationResponse(
          await unfollowUser(session.user.id, user.id),
          session.user.id,
          user.id
        );
      case "friend_request":
        return relationResponse(
          await sendFriendRequest(session.user.id, user.id),
          session.user.id,
          user.id,
          201
        );
      case "friend_cancel":
        return relationResponse(
          await cancelFriendRequestByUsers(session.user.id, user.id),
          session.user.id,
          user.id
        );
      case "mute":
        return relationResponse(
          await muteUser(session.user.id, user.id),
          session.user.id,
          user.id
        );
      case "unmute":
        return relationResponse(
          await unmuteUser(session.user.id, user.id),
          session.user.id,
          user.id
        );
      case "report": {
        if (!body.reason) {
          return await jsonLocalizedError("reason is required", 400);
        }
        return NextResponse.json(
          await reportTarget({
            reporterId: session.user.id,
            targetType: "user",
            targetId: user.id,
            reason: body.reason,
            details: body.details,
          }),
          { status: 201 }
        );
      }
      default:
        return await jsonLocalizedError("Unknown action", 400);
    }
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/users/[username] failed", error);
    return await jsonLocalizedError("Action failed", 500);
  }
}
