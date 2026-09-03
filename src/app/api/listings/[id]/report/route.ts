import { NextRequest, NextResponse } from "next/server";

import { reportListing } from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as {
      reason?: string;
      details?: string;
    };
    if (!body.reason) {
      return await jsonLocalizedError("reason is required", 400);
    }
    const result = await reportListing({
      listingId: id,
      reporterId: session.user.id,
      reason: body.reason,
      details: body.details,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/listings/[id]/report failed", error);
    return await jsonLocalizedError("Could not submit listing report", 500);
  }
}
