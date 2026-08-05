import { NextRequest, NextResponse } from "next/server";

import { recordPostView } from "@/lib/post-analytics";
import { getSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await readApiJson(request).catch(() => ({}))) as {
      discoverySource?: string;
      sessionKey?: string;
      referrerHost?: string;
    };
    const session = await getSession();
    const sessionKey =
      body.sessionKey?.trim() ||
      session?.user?.id ||
      request.headers.get("x-forwarded-for") ||
      crypto.randomUUID();

    const result = await recordPostView({
      postId: id,
      viewerId: session?.user?.id ?? null,
      sessionKey,
      discoverySource: body.discoverySource,
      referrerHost: body.referrerHost,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/posts/[id]/view failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
