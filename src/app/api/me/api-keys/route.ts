import { NextRequest, NextResponse } from "next/server";

import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

/** List personal API keys (secrets are never returned again). */
export async function GET() {
  try {
    const session = await requireSession();
    const keys = await listApiKeys(session.user.id);
    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/me/api-keys failed", error);
    return await jsonLocalizedError("Failed to load", 500);
  }
}

/** Create a key — raw secret is returned once. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => ({}))) as {
      name?: string;
    };
    const created = await createApiKey({
      userId: session.user.id,
      name: body.name,
    });
    return NextResponse.json(
      {
        key: created.key,
        record: created.record,
        hint: "Store this key now. It will not be shown again. Use Authorization: Bearer <key> on /api.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/me/api-keys failed", error);
    return await jsonLocalizedError("Failed to create key", 500);
  }
}

/** Revoke a key: { id } */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      id?: string;
    } | null;
    if (!body?.id) {
      return await jsonLocalizedError("id is required", 400);
    }
    const ok = await revokeApiKey({
      userId: session.user.id,
      keyId: body.id,
    });
    if (!ok) {
      return await jsonLocalizedError("Key not found", 404);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/me/api-keys failed", error);
    return await jsonLocalizedError("Failed to revoke key", 500);
  }
}
