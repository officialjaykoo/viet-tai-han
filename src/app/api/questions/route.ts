import { NextRequest, NextResponse } from "next/server";

import {
  createQuestion,
  listQuestions,
  serializeQuestionSummary,
} from "@/lib/qna";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import {
  AuthError,
  jsonAuthError,
  getSession,
  requireSession,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const subredditName = request.nextUrl.searchParams.get("subreddit");
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    if (rawLimit && Number.isNaN(limit)) {
      return await jsonLocalizedError("Invalid limit", 400);
    }

    const questions = await listQuestions({
      limit,
      subredditName,
      viewerUserId: session?.user?.id ?? null,
    });
    return NextResponse.json({
      questions: questions.map(serializeQuestionSummary),
    });
  } catch (error) {
    console.error("GET /api/questions failed", error);
    return await jsonLocalizedError("Failed to load questions", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = requireBotAttestation(await readApiJson(request)) as {
      community?: string;
      title?: string;
      body?: string;
    };
    if (!body.community || !body.title || !body.body) {
      return await jsonLocalizedError(
        "community, title, and body are required",
        400
      );
    }

    const user = session.user as { id: string; status?: string | null };
    const result = await createQuestion({
      userId: user.id,
      userStatus: user.status,
      subredditName: body.community,
      title: body.title,
      body: body.body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/questions failed", error);
    return await jsonLocalizedError("Failed to create question", 500);
  }
}
