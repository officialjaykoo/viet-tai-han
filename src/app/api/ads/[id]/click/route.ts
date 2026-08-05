import { NextRequest, NextResponse } from "next/server";

import { recordAdClick } from "@/lib/ads";
import { getTunnelContext } from "@/lib/security/tunnel-context";
import { getSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
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
    console.error("GET /api/ads/[id]/click failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
