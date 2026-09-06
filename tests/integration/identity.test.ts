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
  it("assigns a temporary username to OAuth users without one", async () => {
    const auth = createAuth(env.DB);
    const context = await auth.$context;
    const userId = `oauth_${crypto.randomUUID()}`;

    await context.internalAdapter.createUser({
      id: userId,
      name: "OAuth User",
      email: `${userId}@oauth.test`,
      emailVerified: false,
      image: null,
    });

    const row = await env.DB.prepare(
      `SELECT username, displayUsername FROM "user" WHERE id = ?`
    )
      .bind(userId)
      .first<{ username: string; displayUsername: string }>();

    expect(row?.username).toMatch(/^vth_user_[a-f0-9]{12}$/);
    expect(row?.displayUsername).toBe(row?.username);
  });

  it("keeps at least one social account connected", async () => {
    const auth = createAuth(env.DB);
    const context = await auth.$context;
    const userId = `unlink_${crypto.randomUUID()}`;

    await context.internalAdapter.createUser({
      id: userId,
      name: "Unlink User",
      email: `${userId}@oauth.test`,
      emailVerified: false,
      image: null,
    });
    const facebook = await context.internalAdapter.createAccount({
      accountId: `${userId}_facebook`,
      providerId: "facebook",
      userId,
    });
    const zalo = await context.internalAdapter.createAccount({
      accountId: `${userId}_zalo`,
      providerId: "zalo",
      userId,
    });

    await context.internalAdapter.deleteAccount(facebook.id);
    await expect(
      context.internalAdapter.deleteAccount(zalo.id)
    ).rejects.toThrow("At least one social account must remain connected");

    const remaining = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM account WHERE userId = ?`
    )
      .bind(userId)
      .first<{ count: number }>();
    expect(remaining?.count).toBe(1);
  });
  it("blocks credential authentication endpoints", async () => {
    const auth = createAuth(env.DB);

    for (const path of [
      "sign-up/email",
      "sign-in/email",
      "sign-in/username",
      "change-password",
      "set-password",
      "request-password-reset",
      "reset-password",
      "verify-password",
    ]) {
      const response = await startOAuth(auth, path, {});
      expect(response.status).toBe(404);
    }
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
