import { NextRequest, NextResponse } from "next/server";

import {
  getBusinessDetail,
  serializeBusinessDetail,
  updateBusiness,
  updateBusinessStatus,
} from "@/lib/businesses";
import { BUSINESS_STATUSES } from "@/lib/business-constants";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, getSession, jsonAuthError, requireSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const business = await getBusinessDetail(id, session?.user?.id ?? null);
    if (!business) return await jsonLocalizedError("Business not found", 404);
    return NextResponse.json(serializeBusinessDetail(business));
  } catch (error) {
    console.error("GET /api/businesses/[id] failed", error);
    return await jsonLocalizedError("Failed to load business", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const rawBody = await readApiJson(request);
    const body = rawBody as {
      status?: string;
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
    if (body.status) {
      if (!(BUSINESS_STATUSES as readonly string[]).includes(body.status)) {
        return await jsonLocalizedError("Invalid business status", 400);
      }
      return NextResponse.json(
        await updateBusinessStatus({
          businessId: id,
          ownerId: session.user.id,
          status: body.status,
        })
      );
    }
    const profileBody = requireBotAttestation(rawBody) as Omit<
      typeof body,
      "status"
    >;
    if (
      !profileBody.name ||
      !profileBody.description ||
      !profileBody.category ||
      !profileBody.address ||
      !profileBody.location
    ) {
      return await jsonLocalizedError("Required business fields are missing", 400);
    }
    const result = await updateBusiness({
      businessId: id,
      ownerId: session.user.id,
      name: profileBody.name,
      description: profileBody.description,
      category: profileBody.category,
      address: profileBody.address,
      location: profileBody.location,
      phone: profileBody.phone,
      websiteUrl: profileBody.websiteUrl,
      latitude: profileBody.latitude,
      longitude: profileBody.longitude,
      openingHours: profileBody.openingHours,
      services: profileBody.services,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/businesses/[id] failed", error);
    return await jsonLocalizedError("Failed to update business", 500);
  }
}
