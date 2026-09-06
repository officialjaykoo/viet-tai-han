import { NextRequest, NextResponse } from "next/server";

import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";
import { changeUsername } from "@/lib/username-lifecycle";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      username?: string;
    } | null;

    if (typeof body?.username !== "string") {
      return await jsonLocalizedError("Username is required", 400);
    }

    const settings = await changeUsername({
      userId: session.user.id,
      username: body.username,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/username failed", error);
    return await jsonLocalizedError("Failed to save", 500);
  }
}
