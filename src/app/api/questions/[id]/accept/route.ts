import { NextRequest, NextResponse } from "next/server";

import { parseAcceptAnswerPayload } from "@/lib/content-payload";
import { toggleAcceptedAnswer } from "@/lib/qna";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: questionId } = await context.params;
    const body = parseAcceptAnswerPayload(await readApiJson(request));

    const result = await toggleAcceptedAnswer({
      userId: session.user.id,
      questionId,
      answerId: body.answerId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/questions/[id]/accept failed", error);
    return await jsonLocalizedError("Failed to update accepted answer", 500);
  }
}
