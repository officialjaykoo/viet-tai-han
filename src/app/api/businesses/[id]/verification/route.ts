import { NextRequest, NextResponse } from "next/server";

import { submitBusinessVerification } from "@/lib/businesses";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = requireBotAttestation(await readApiJson(request)) as {
      evidence?: string;
    };
    if (!body.evidence) {
      return await jsonLocalizedError("Verification evidence is required", 400);
    }
    return NextResponse.json(
      await submitBusinessVerification({
        businessId: id,
        ownerId: session.user.id,
        evidence: body.evidence,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/businesses/[id]/verification failed", error);
    return await jsonLocalizedError("Failed to submit verification", 500);
  }
}
