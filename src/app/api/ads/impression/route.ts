import { NextRequest, NextResponse } from "next/server";

import { recordAdImpression } from "@/lib/ads";
import { getSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

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
    await recordAdImpression({
      campaignId: body.campaignId,
      placement: body.placement,
      viewerId: session?.user?.id ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/ads/impression failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
