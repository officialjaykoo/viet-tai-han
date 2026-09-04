import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createAuth } from "@/lib/auth";

async function startOAuth(
  auth: ReturnType<typeof createAuth>,
  path: string,
  body: Record<string, unknown>
) {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify(body),
    })
  );
}

describe("identity providers", () => {
  it("installs the Better Auth passkey schema", async () => {
    const result = await env.DB.prepare("PRAGMA table_info(passkey)").all<{
      name: string;
    }>();

    expect(result.results.map((column) => column.name)).toEqual([
      "id",
      "name",
      "publicKey",
      "userId",
      "credentialID",
      "counter",
      "deviceType",
      "backedUp",
      "transports",
      "createdAt",
      "aaguid",
    ]);
  });

  it("starts Facebook OAuth with the configured callback", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });
    const response = await startOAuth(auth, "sign-in/social", {
      provider: "facebook",
      callbackURL: "/settings?section=account",
    });
    const payload = (await response.json()) as { url?: string };

    expect(response.status).toBe(200);
    const authorizationURL = new URL(payload.url!);
    expect(authorizationURL.hostname).toContain("facebook.com");
    expect(authorizationURL.searchParams.get("client_id")).toBe(
      "facebook-client"
    );
    expect(authorizationURL.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/facebook"
    );
  });

  it("starts Zalo OAuth with PKCE and the generic callback", async () => {
    const auth = createAuth(env.DB, {
      ZALO_APP_ID: "zalo-app",
      ZALO_APP_SECRET: "zalo-secret",
    });
    const response = await startOAuth(auth, "sign-in/oauth2", {
      providerId: "zalo",
      callbackURL: "/settings?section=account",
    });
    const payload = (await response.json()) as { url?: string };

    expect(response.status).toBe(200);
    const authorizationURL = new URL(payload.url!);
    expect(authorizationURL.origin + authorizationURL.pathname).toBe(
      "https://oauth.zaloapp.com/v4/permission"
    );
    expect(authorizationURL.searchParams.get("app_id")).toBe("zalo-app");
    expect(authorizationURL.searchParams.get("client_id")).toBe("zalo-app");
    expect(authorizationURL.searchParams.get("code_challenge_method")).toBe(
      "S256"
    );
    expect(authorizationURL.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorizationURL.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/oauth2/callback/zalo"
    );
  });
});
