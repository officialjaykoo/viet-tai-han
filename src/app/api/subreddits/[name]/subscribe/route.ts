import { NextRequest, NextResponse } from "next/server";

import {
  subscribeToSubreddit,
  unsubscribeFromSubreddit,
} from "@/lib/communities";
import { getSubredditByName } from "@/lib/content";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireSignedApiRequest } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    await requireSignedApiRequest(request, "POST");
    const session = await requireSession();
    const { name } = await context.params;
    const sub = await getSubredditByName(name);
    if (!sub || sub.is_removed) {
      return await jsonLocalizedError("Not found", 404);
    }

    const result = await subscribeToSubreddit(session.user.id, sub.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/subreddits/[name]/subscribe failed", error);
    return await jsonLocalizedError("Failed to join community", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    await requireSignedApiRequest(request, "DELETE");
    const session = await requireSession();
    const { name } = await context.params;
    const sub = await getSubredditByName(name);
    if (!sub || sub.is_removed) {
      return await jsonLocalizedError("Not found", 404);
    }

    const result = await unsubscribeFromSubreddit(session.user.id, sub.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("DELETE /api/subreddits/[name]/subscribe failed", error);
    return await jsonLocalizedError("Failed to leave community", 500);
  }
}
