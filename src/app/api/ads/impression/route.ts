import { NextRequest, NextResponse } from "next/server";

import { recordAdImpression } from "@/lib/ads";
import { getMonetizationContext } from "@/lib/monetization";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { checkSubjectRateLimit } from "@/lib/rate-limit";
import { AuthError, jsonAuthError, getSession } from "@/lib/session";
export async function POST(request: NextRequest) {
  try {
    const body = (await readApiJson(request)) as {
      campaignId?: string;
      placement?: string;
    };
    if (!body.campaignId || !body.placement) {
      return await jsonLocalizedError("Missing fields", 400);
    }

    const session = await getSession();
    const viewerId = session?.user?.id ?? null;
    const monetization = await getMonetizationContext(viewerId);
    if (!viewerId || !monetization.analyticsAllowed || monetization.isPro) {
      return NextResponse.json({ ok: true, recorded: false });
    }

    const limited = await checkSubjectRateLimit({
      subject: `user:${viewerId}`,
      action: "ad:impression",
      limit: 60,
      windowSeconds: 60,
    });
    if (!limited.allowed) {
      return await jsonLocalizedError("Too many ad events", 429);
    }

    const recorded = await recordAdImpression({
      campaignId: body.campaignId,
      placement: body.placement,
      viewerId,
    });
    return NextResponse.json({ ok: true, recorded });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/ads/impression failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
