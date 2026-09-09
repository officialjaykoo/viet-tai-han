import { NextRequest, NextResponse } from "next/server";

import { createAnswer } from "@/lib/qna";
import { parseAnswerPayload } from "@/lib/content-payload";
import { requestIdFromHeaders } from "@/lib/idempotency";
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
    const user = session.user;
    const { id: questionId } = await context.params;
    const body = parseAnswerPayload(
      requireBotAttestation(await readApiJson(request))
    );

    const result = await createAnswer({
      userId: user.id,
      userStatus: user.status,
      questionId,
      body: body.body,
      requestId: body.requestId ?? requestIdFromHeaders(request.headers),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/questions/[id]/answers failed", error);
    return await jsonLocalizedError("Failed to create answer", 500);
  }
}
