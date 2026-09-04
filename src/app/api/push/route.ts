import { NextRequest, NextResponse } from "next/server";

import {
  deletePushSubscription,
  getPushStatus,
  savePushSubscription,
  validatePushSubscription,
} from "@/lib/push";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getPushStatus(session.user.id));
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/push failed", error);
    return await jsonLocalizedError("Failed to load push settings", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await readApiJson(request).catch(() => null);
    const subscription = validatePushSubscription(body);
    await savePushSubscription(session.user.id, subscription);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/push failed", error);
    return await jsonLocalizedError("Failed to enable push notifications", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      endpoint?: unknown;
    } | null;
    if (typeof body?.endpoint !== "string" || body.endpoint.length > 2048) {
      return await jsonLocalizedError("endpoint is required", 400);
    }
    let endpoint: URL;
    try {
      endpoint = new URL(body.endpoint);
    } catch {
      return await jsonLocalizedError("Invalid push subscription endpoint", 400);
    }
    if (endpoint.protocol !== "https:") {
      return await jsonLocalizedError("Invalid push subscription endpoint", 400);
    }
    const result = await deletePushSubscription(
      session.user.id,
      endpoint.toString()
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/push failed", error);
    return await jsonLocalizedError("Failed to disable push notifications", 500);
  }
}
