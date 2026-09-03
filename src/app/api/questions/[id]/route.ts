import { NextRequest, NextResponse } from "next/server";

import {
  getQuestionDetail,
  serializeQuestionDetail,
} from "@/lib/qna";
import { jsonLocalizedError } from "@/lib/public-error";
import { getSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const question = await getQuestionDetail(id, session?.user?.id ?? null);
    if (!question) return await jsonLocalizedError("Question not found", 404);
    return NextResponse.json(serializeQuestionDetail(question));
  } catch (error) {
    console.error("GET /api/questions/[id] failed", error);
    return await jsonLocalizedError("Failed to load question", 500);
  }
}
