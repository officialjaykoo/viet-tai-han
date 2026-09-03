import { NextRequest, NextResponse } from "next/server";

import {
  createBusiness,
  listBusinesses,
  serializeBusinessSummary,
} from "@/lib/businesses";
import { BUSINESS_STATUSES } from "@/lib/business-constants";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, getSession, jsonAuthError, requireSession } from "@/lib/session";

function isStatus(value: string): value is (typeof BUSINESS_STATUSES)[number] {
  return (BUSINESS_STATUSES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const rawLimit = params.get("limit");
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    if (rawLimit && Number.isNaN(limit)) {
      return await jsonLocalizedError("Invalid limit", 400);
    }
    if (status && status !== "all" && !isStatus(status)) {
      return await jsonLocalizedError("Invalid business status", 400);
    }
    if (params.get("mine") === "1" && !session?.user?.id) {
      return await jsonLocalizedError("Sign in to view your businesses", 401);
    }
    const businesses = await listBusinesses({
      query: params.get("q"),
      category: params.get("category"),
      location: params.get("location"),
      status: status as (typeof BUSINESS_STATUSES)[number] | "all" | null,
      viewerUserId: session?.user?.id ?? null,
      ownerOnly: params.get("mine") === "1",
      limit,
    });
    return NextResponse.json({
      businesses: businesses.map(serializeBusinessSummary),
    });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/businesses failed", error);
    return await jsonLocalizedError("Failed to load businesses", 500);
  }
}
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = requireBotAttestation(await readApiJson(request)) as {
      name?: string;
      description?: string;
      category?: string;
      address?: string;
      location?: string;
      phone?: string | null;
      websiteUrl?: string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      openingHours?: string | null;
      services?: Array<{
        name: string;
        description?: string | null;
        price?: string | null;
        durationMinutes?: number;
      }>;
    };
    if (!body.name || !body.description || !body.category || !body.address || !body.location) {
      return await jsonLocalizedError("Required business fields are missing", 400);
    }
    const result = await createBusiness({
      ownerId: session.user.id,
      ownerStatus: (session.user as { status?: string | null }).status,
      name: body.name,
      description: body.description,
      category: body.category,
      address: body.address,
      location: body.location,
      phone: body.phone,
      websiteUrl: body.websiteUrl,
      latitude: body.latitude,
      longitude: body.longitude,
      openingHours: body.openingHours,
      services: body.services,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/businesses failed", error);
    return await jsonLocalizedError("Failed to create business profile", 500);
  }
}
