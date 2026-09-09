import { NextRequest, NextResponse } from "next/server";

import { jsonLocalizedError } from "@/lib/public-error";
import { setPostSaved } from "@/lib/post-saves";
import { readApiJson } from "@/lib/security/guard";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const body = await readApiJson(request);
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      typeof (body as { saved?: unknown }).saved !== "boolean"
    ) {
      return await jsonLocalizedError("saved must be a boolean", 400);
    }

    const { id } = await context.params;
    return NextResponse.json(
      await setPostSaved({
        userId: session.user.id,
        postId: id,
        saved: (body as { saved: boolean }).saved,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/posts/[id]/save failed", error);
    return await jsonLocalizedError("Failed to update saved post", 500);
  }
}
