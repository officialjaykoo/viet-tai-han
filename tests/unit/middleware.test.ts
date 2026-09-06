import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

function request(pathname: string, init?: RequestInit) {
  return new NextRequest(`https://vth.kr${pathname}`, init);
}

describe("middleware OAuth callback handling", () => {
  it.each([
    "/api/auth/callback/facebook?code=test",
    "/api/auth/callback/kakao?code=test",
    "/api/auth/oauth2/callback/zalo?code=test",
  ])("allows browser callback %s without an API key", (pathname) => {
    const response = middleware(request(pathname, { method: "GET" }));

    expect(response.status).toBe(200);
  });

  it("keeps API-key protection for non-callback API requests", () => {
    const response = middleware(
      request("/api/posts", {
        method: "GET",
        headers: {
          accept: "text/html",
          "sec-fetch-dest": "document",
          "user-agent": "Mozilla/5.0",
        },
      })
    );

    expect(response.status).toBe(404);
  });

  it("requires an API key for non-GET OAuth callback requests", () => {
    const response = middleware(
      request("/api/auth/callback/facebook", { method: "POST" })
    );

    expect(response.status).toBe(401);
  });
});
