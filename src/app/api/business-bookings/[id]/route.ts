import { NextRequest, NextResponse } from "next/server";

import { updateBusinessBooking } from "@/lib/businesses";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request)) as {
      status?: string;
      ownerNote?: string | null;
    };
    if (!body.status) {
      return await jsonLocalizedError("Booking status is required", 400);
    }
    return NextResponse.json(
      await updateBusinessBooking({
        bookingId: id,
        viewerUserId: session.user.id,
        status: body.status,
        ownerNote: body.ownerNote,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/business-bookings/[id] failed", error);
    return await jsonLocalizedError("Failed to update booking", 500);
  }
}
