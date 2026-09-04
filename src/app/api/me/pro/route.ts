import { NextResponse } from "next/server";

import { getProStatus } from "@/lib/monetization";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ pro: await getProStatus(session.user.id) });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/me/pro failed", error);
    return await jsonLocalizedError("Could not load Pro status", 500);
  }
}
