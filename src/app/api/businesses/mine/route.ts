import { NextResponse } from "next/server";

import { listOwnedBusinesses, serializeBusinessSummary } from "@/lib/businesses";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    const businesses = await listOwnedBusinesses(session.user.id);
    return NextResponse.json({ businesses: businesses.map(serializeBusinessSummary) });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/businesses/mine failed", error);
    return await jsonLocalizedError("Failed to load your businesses", 500);
  }
}
