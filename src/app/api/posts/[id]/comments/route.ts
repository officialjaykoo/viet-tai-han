import { NextRequest, NextResponse } from "next/server";

import { createComment } from "@/lib/actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { requireBotAttestation } from "@/lib/security/bot-guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: postId } = await context.params;
    const body = requireBotAttestation(await readApiJson(request)) as {
      body?: string;
      parentId?: string | null;
    };

    if (!body.body?.trim()) {
      return await jsonLocalizedError("body is required", 400);
    }

    const user = session.user as { id: string; status?: string | null };
    const result = await createComment({
      userId: user.id,
      userStatus: user.status,
      postId,
      parentId: body.parentId,
      body: body.body,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/posts/[id]/comments failed", error);
    return await jsonLocalizedError("Failed to create comment", 500);
  }
}
