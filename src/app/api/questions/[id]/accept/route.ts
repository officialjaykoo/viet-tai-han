import { NextRequest, NextResponse } from "next/server";

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
    const body = (await readApiJson(request)) as { answerId?: string };
    if (!body.answerId?.trim()) {
      return await jsonLocalizedError("answerId is required", 400);
    }

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
