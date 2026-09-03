import { NextRequest, NextResponse } from "next/server";

import { toggleListingSave } from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const result = await toggleListingSave({
      listingId: id,
      userId: session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/listings/[id]/save failed", error);
    return await jsonLocalizedError("Failed to save listing", 500);
  }
}
