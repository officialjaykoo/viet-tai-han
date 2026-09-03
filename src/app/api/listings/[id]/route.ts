import { NextRequest, NextResponse } from "next/server";

import {
  getListingDetail,
  serializeListingDetail,
  updateListingStatus,
} from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, getSession, jsonAuthError, requireSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const listing = await getListingDetail(id, session?.user?.id ?? null);
    if (!listing) return await jsonLocalizedError("Listing not found", 404);
    return NextResponse.json(serializeListingDetail(listing));
  } catch (error) {
    console.error("GET /api/listings/[id] failed", error);
    return await jsonLocalizedError("Failed to load listing", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as { status?: string };
    if (!body.status) {
      return await jsonLocalizedError("status is required", 400);
    }
    const result = await updateListingStatus({
      listingId: id,
      sellerId: session.user.id,
      status: body.status,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/listings/[id] failed", error);
    return await jsonLocalizedError("Failed to update listing", 500);
  }
}
