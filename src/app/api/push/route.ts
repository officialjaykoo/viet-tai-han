import { NextRequest, NextResponse } from "next/server";

import {
  deletePushSubscription,
  getPushStatus,
  normalizePushEndpoint,
  savePushSubscription,
  validatePushSubscription,
} from "@/lib/push";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const rawEndpoint = request.nextUrl.searchParams.get("endpoint");
    const endpoint = rawEndpoint ? normalizePushEndpoint(rawEndpoint) : null;
    return NextResponse.json(
      await getPushStatus(session.user.id, endpoint)
    );
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/push failed", error);
    return await jsonLocalizedError("Failed to load push settings", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const subscription = validatePushSubscription(
      await readApiJson(request).catch(() => null)
    );
    const result = await savePushSubscription(session.user.id, subscription);
    return NextResponse.json({
      ...result,
      ...(await getPushStatus(session.user.id, subscription.endpoint)),
    });
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
    if (body?.endpoint === undefined) {
      return await jsonLocalizedError("endpoint is required", 400);
    }
    const endpoint = normalizePushEndpoint(body.endpoint);
    const result = await deletePushSubscription(session.user.id, endpoint);
    return NextResponse.json({
      ...result,
      ...(await getPushStatus(session.user.id, endpoint)),
    });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("DELETE /api/push failed", error);
    return await jsonLocalizedError("Failed to disable push notifications", 500);
  }
}
