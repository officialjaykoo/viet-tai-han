import { NextRequest, NextResponse } from "next/server";

import { hidePost, unhidePost } from "@/lib/user-actions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireSignedApiRequest } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSignedApiRequest(request, "POST");
    const session = await requireSession();
    const { id } = await context.params;
    const result = await hidePost(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST hide failed", error);
    return await jsonLocalizedError("Could not hide post", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSignedApiRequest(request, "DELETE");
    const session = await requireSession();
    const { id } = await context.params;
    const result = await unhidePost(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE hide failed", error);
    return await jsonLocalizedError("Could not unhide post", 500);
  }
}
