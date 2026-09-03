import { NextRequest, NextResponse } from "next/server";

import { listSavedListings, serializeListingSummary } from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireSession();
    const listings = await listSavedListings(session.user.id);
    return NextResponse.json({
      listings: listings.map(serializeListingSummary),
    });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/listings/saved failed", error);
    return await jsonLocalizedError("Failed to load saved listings", 500);
  }
}
