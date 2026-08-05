import { NextRequest, NextResponse } from "next/server";

import { reportTarget } from "@/lib/user-actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await readApiJson(request).catch(() => null)) as {
      reason?: string;
      details?: string;
    } | null;

    if (!body?.reason) {
      return await jsonLocalizedError("reason is required", 400);
    }

    const result = await reportTarget({
      reporterId: session.user.id,
      targetType: "post",
      targetId: id,
      reason: body.reason,
      details: body.details,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST report post failed", error);
    return await jsonLocalizedError("Could not submit report", 500);
  }
}
