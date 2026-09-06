import { describe, expect, it } from "vitest";

import { guardWorkerRequest } from "@/lib/worker-ingress";

function request(pathname: string, init?: RequestInit) {
  return new Request(`https://vth.kr${pathname}`, init);
}

describe("Worker ingress OAuth callback handling", () => {
  it.each([
    "/api/auth/callback/facebook?code=test",
    "/api/auth/callback/kakao?code=test",
    "/api/auth/oauth2/callback/zalo?code=test",
  ])("allows browser callback %s without an API key", (pathname) => {
    const response = guardWorkerRequest(request(pathname, { method: "GET" }));

    expect(response).toBeNull();
  });

  it("keeps API-key protection for non-callback API requests", () => {
    const response = guardWorkerRequest(
      request("/api/posts", {
        method: "GET",
        headers: {
          accept: "text/html",
          "sec-fetch-dest": "document",
          "user-agent": "Mozilla/5.0",
        },
      })
    );

    expect(response?.status).toBe(404);
  });

  it("requires an API key for non-GET OAuth callback requests", () => {
    const response = guardWorkerRequest(
      request("/api/auth/callback/facebook", { method: "POST" })
    );

    expect(response?.status).toBe(401);
  });

  it("keeps hidden internal paths undiscoverable", () => {
    const response = guardWorkerRequest(
      request("/i/api", { method: "GET", headers: { accept: "application/json" } })
    );

    expect(response?.status).toBe(404);
  });
});
