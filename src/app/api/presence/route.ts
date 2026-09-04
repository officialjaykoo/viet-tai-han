import { NextResponse } from "next/server";

import { listOnlineUsers, touchUserPresence } from "@/lib/presence";
import { jsonLocalizedError } from "@/lib/public-error";
import {
  AuthError,
  getSession,
  jsonAuthError,
  requireSession,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    const users = await listOnlineUsers(session?.user?.id ?? null);
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/presence failed", error);
    return await jsonLocalizedError("Failed to load online users", 500);
  }
}

export async function POST() {
  try {
    const session = await requireSession();
    await touchUserPresence(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/presence failed", error);
    return await jsonLocalizedError("Failed to update online status", 500);
  }
}
