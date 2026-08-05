import { NextRequest, NextResponse } from "next/server";

import { enforceExpensiveIpRateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/security/challenge";
import { searchAll, searchCommunitiesQuery } from "@/lib/search";
import { AuthError, jsonAuthError } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    await enforceExpensiveIpRateLimit(ip, "search:burst");

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const type = request.nextUrl.searchParams.get("type");
    const suggest = request.nextUrl.searchParams.get("suggest") === "1";

    if (type === "communities") {
      const communities = await searchCommunitiesQuery(q, 12);
      return NextResponse.json({ communities });
    }

    const results = await searchAll(
      q,
      suggest
        ? { communities: 4, accounts: 4, posts: 5 }
        : undefined
    );
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("GET /api/search failed", error);
    return await jsonLocalizedError("Search failed", 500);
  }
}
