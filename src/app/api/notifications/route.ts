import { NextRequest, NextResponse } from "next/server";

import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const countOnly =
      request.nextUrl.searchParams.get("count") === "1";
    if (countOnly) {
      const unreadCount = await countUnreadNotifications(session.user.id);
      return NextResponse.json({ unreadCount });
    }

    const unreadOnly =
      request.nextUrl.searchParams.get("unread") === "1";
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(session.user.id, { unreadOnly }),
      countUnreadNotifications(session.user.id),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/notifications failed", error);
    return await jsonLocalizedError("Failed to load", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request)) as {
      action?: "mark_read" | "mark_all_read";
      ids?: string[];
    };

    if (body.action === "mark_all_read") {
      await markNotificationsRead({ userId: session.user.id, all: true });
      return NextResponse.json({ ok: true, unreadCount: 0 });
    }

    if (body.action === "mark_read") {
      await markNotificationsRead({
        userId: session.user.id,
        ids: body.ids ?? [],
      });
      const unreadCount = await countUnreadNotifications(session.user.id);
      return NextResponse.json({ ok: true, unreadCount });
    }

    return await jsonLocalizedError("Unknown action", 400);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/notifications failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
