import { NextRequest, NextResponse } from "next/server";

import {
  createListingAlert,
  deleteListingAlert,
  listListingAlerts,
} from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireSession();
    return NextResponse.json({ alerts: await listListingAlerts(session.user.id) });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/listing-alerts failed", error);
    return await jsonLocalizedError("Failed to load listing alerts", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request)) as {
      query?: string;
      kind?: string;
      category?: string;
      location?: string;
    };
    const alert = await createListingAlert({
      userId: session.user.id,
      query: body.query,
      kind: body.kind,
      category: body.category,
      location: body.location,
    });
    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/listing-alerts failed", error);
    return await jsonLocalizedError("Failed to save listing alert", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request)) as { id?: string };
    if (!body.id) return await jsonLocalizedError("id is required", 400);
    const result = await deleteListingAlert({
      userId: session.user.id,
      alertId: body.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/listing-alerts failed", error);
    return await jsonLocalizedError("Failed to delete listing alert", 500);
  }
}
