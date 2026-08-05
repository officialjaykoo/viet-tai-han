import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  blockUser,
  followUser,
  reportTarget,
  unblockUser,
  unfollowUser,
} from "@/lib/user-actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

async function resolveUserId(username: string) {
  const db = await getDb();
  return db
    .prepare(`SELECT id FROM "user" WHERE username = ? COLLATE NOCASE`)
    .bind(username)
    .first<{ id: string }>();
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

    const body = (await readApiJson(request).catch(() => ({}))) as {
      action?: "follow" | "unfollow" | "block" | "unblock" | "report";
      reason?: string;
      details?: string;
    };

    switch (body.action) {
      case "follow":
        return NextResponse.json(await followUser(session.user.id, user.id));
      case "unfollow":
        return NextResponse.json(
          await unfollowUser(session.user.id, user.id)
        );
      case "block":
        return NextResponse.json(await blockUser(session.user.id, user.id));
      case "unblock":
        return NextResponse.json(await unblockUser(session.user.id, user.id));
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
