import { NextRequest, NextResponse } from "next/server";

import { recordAdClick } from "@/lib/ads";
import { getTunnelContext } from "@/lib/security/tunnel-context";
import { requireSignedHeaders } from "@/lib/security/guard";
import { checkSubjectRateLimit } from "@/lib/rate-limit";
import { getSession, AuthError, jsonAuthError } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { ip } = await requireSignedHeaders(request);
    const { id } = await context.params;
    const session = await getSession();
    const subject = session?.user?.id ? `user:${session.user.id}` : `ip:${ip}`;
    const limited = await checkSubjectRateLimit({
      subject,
      action: "ad:click",
      limit: 20,
      windowSeconds: 60,
    });
    if (!limited.allowed) {
      return await jsonLocalizedError("Too many ad events", 429);
    }

    const target = await recordAdClick({
      campaignId: id,
      viewerId: session?.user?.id ?? null,
    });
    if (!target) {
      return await jsonLocalizedError("Not found", 404);
    }
    // App clients load via /i/api — return JSON so the browser opens the URL.
    if (getTunnelContext()?.verified) {
      return NextResponse.json({ redirect: target });
    }
    return NextResponse.redirect(target, 302);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/ads/[id]/click failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
