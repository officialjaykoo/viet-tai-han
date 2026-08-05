import { NextRequest, NextResponse } from "next/server";

import { recordPostLinkClick } from "@/lib/post-analytics";
import { getTunnelContext } from "@/lib/security/tunnel-context";
import { getSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const sessionKey =
      request.cookies.get("red_view_session")?.value ??
      request.headers.get("x-forwarded-for") ??
      null;

    const target = await recordPostLinkClick({
      postId: id,
      viewerId: session?.user?.id ?? null,
      sessionKey,
    });
    if (!target) {
      return await jsonLocalizedError("Not found", 404);
    }
    if (getTunnelContext()?.verified) {
      return NextResponse.json({ redirect: target });
    }
    return NextResponse.redirect(target, 302);
  } catch (error) {
    console.error("GET /api/posts/[id]/out failed", error);
    return await jsonLocalizedError("Failed", 500);
  }
}
