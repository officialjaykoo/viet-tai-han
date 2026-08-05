import { NextRequest, NextResponse } from "next/server";

import { setUserNsfw } from "@/lib/achievements";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      isNsfw?: boolean;
    } | null;

    if (typeof body?.isNsfw !== "boolean") {
      return await jsonLocalizedError("isNsfw boolean is required", 400);
    }

    const result = await setUserNsfw(session.user.id, body.isNsfw);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/me/nsfw failed", error);
    return await jsonLocalizedError("Could not update NSFW setting", 500);
  }
}
