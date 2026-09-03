import { NextRequest, NextResponse } from "next/server";

import {
  createBusinessBooking,
  listBusinessBookings,
  serializeBusinessBooking,
} from "@/lib/businesses";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const bookings = await listBusinessBookings({
      businessId: id,
      viewerUserId: session.user.id,
    });
    return NextResponse.json({ bookings: bookings.map(serializeBusinessBooking) });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/businesses/[id]/bookings failed", error);
    return await jsonLocalizedError("Failed to load bookings", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as {
      serviceId?: string | null;
      startAt?: string;
      durationMinutes?: number;
      note?: string | null;
    };
    if (!body.startAt) {
      return await jsonLocalizedError("Booking time is required", 400);
    }
    return NextResponse.json(
      await createBusinessBooking({
        businessId: id,
        requesterId: session.user.id,
        serviceId: body.serviceId,
        startAt: body.startAt,
        durationMinutes: body.durationMinutes,
        note: body.note,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/businesses/[id]/bookings failed", error);
    return await jsonLocalizedError("Failed to request booking", 500);
  }
}
