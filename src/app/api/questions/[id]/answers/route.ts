import { NextRequest, NextResponse } from "next/server";

import { createAnswer } from "@/lib/qna";
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
    const { id: questionId } = await context.params;
    const body = requireBotAttestation(await readApiJson(request)) as {
      body?: string;
    };
    if (!body.body?.trim()) {
      return await jsonLocalizedError("body is required", 400);
    }

    const user = session.user as { id: string; status?: string | null };
    const result = await createAnswer({
      userId: user.id,
      userStatus: user.status,
      questionId,
      body: body.body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/questions/[id]/answers failed", error);
    return await jsonLocalizedError("Failed to create answer", 500);
  }
}
