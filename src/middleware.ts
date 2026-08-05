import { NextRequest, NextResponse } from "next/server";

import {
  fakeNotFoundResponse,
  htmlErrorIfBrowser,
  isHiddenPath,
} from "@/lib/http-errors";

/**
 * - Hidden internal paths (/i/*): non-POST → fake 404 (never 405).
 * - Public /api/* without Bearer: browsers get fake 404; machines get 401 JSON.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (isHiddenPath(pathname)) {
    // Real traffic is POST /i/api only. Everything else looks like a missing page.
    if (pathname === "/i/api" && method === "POST") {
      return NextResponse.next();
    }
    return fakeNotFoundResponse();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) {
    const html = htmlErrorIfBrowser(request, "not_found");
    if (html) return html;
    return NextResponse.json(
      {
        error: "API key required",
        hint: "Public /api requires Authorization: Bearer <api_key>.",
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/i", "/i/:path*"],
};
