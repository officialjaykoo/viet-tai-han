import { NextResponse } from "next/server";

import { getUnreadCounts } from "@/lib/unread";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    const counts = await getUnreadCounts(session.user.id);
    return NextResponse.json(counts);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/unread failed", error);
    return await jsonLocalizedError("Failed to load unread counts", 500);
  }
}
