import { NextRequest, NextResponse } from "next/server";

import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";
import { getUnreadCounts } from "@/lib/unread";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const counts = await getUnreadCounts(session.user.id);
    const countOnly =
      request.nextUrl.searchParams.get("count") === "1";
    if (countOnly) {
      return NextResponse.json({
        unreadCount: counts.notificationCount,
        unreadMessages: counts.messageCount,
        totalUnread: counts.totalCount,
      });
    }

    const unreadOnly =
      request.nextUrl.searchParams.get("unread") === "1";
    const notifications = await listNotifications(session.user.id, {
      unreadOnly,
    });
    return NextResponse.json({
      notifications,
      unreadCount: counts.notificationCount,
      unreadMessages: counts.messageCount,
      totalUnread: counts.totalCount,
    });
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
      const counts = await getUnreadCounts(session.user.id);
      return NextResponse.json({
        ok: true,
        unreadCount: counts.notificationCount,
        unreadMessages: counts.messageCount,
        totalUnread: counts.totalCount,
      });
    }

    if (body.action === "mark_read") {
      await markNotificationsRead({
        userId: session.user.id,
        ids: body.ids ?? [],
      });
      const counts = await getUnreadCounts(session.user.id);
      return NextResponse.json({
        ok: true,
        unreadCount: counts.notificationCount,
        unreadMessages: counts.messageCount,
        totalUnread: counts.totalCount,
      });
    }

    return await jsonLocalizedError("Unknown action", 400);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/notifications failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
