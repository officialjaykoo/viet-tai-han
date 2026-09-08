import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createAuth, type Auth } from "@/lib/auth";
import { mapOAuthEmail, mapOAuthProfile } from "@/lib/oauth-identity";
 
const ORIGIN = "http://localhost:3000";

async function startOAuth(
  auth: Auth,
  body: Record<string, unknown>
): Promise<Response> {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
      },
      body: JSON.stringify(body),
    })
  );
}

function setCookiePairs(response: Response): string[] {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const values = [
    ...(getSetCookie?.call(response.headers) ?? []),
    response.headers.get("set-cookie") ?? "",
  ];
  return values
    .flatMap((value) => value.split(/,(?=\s*[^;=]+=[^;]+)/))
    .map((value) => value.trim().split(";")[0] ?? "")
    .filter(Boolean);
}

function cookieHeader(response: Response): string {
  return setCookiePairs(response).join("; ");
}

function cookieName(cookiePair: string): string {
  return cookiePair.slice(0, cookiePair.indexOf("="));
}

function stateCookie(response: Response): string {
  const pair = setCookiePairs(response).find((value) =>
    value.toLowerCase().includes("state=")
  );
  if (!pair) throw new Error("OAuth state cookie was not set");
  return pair;
}

describe("Better Auth session lifecycle", () => {
  it("invalidates the DB session and expires the configured session cookies", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });
    const context = await auth.$context;
    const provider = context.socialProviders.find(
      (candidate) => candidate.id === "facebook"
    );
    expect(provider).toBeDefined();

    const accountId = `logout_${crypto.randomUUID()}`;
    provider!.validateAuthorizationCode = async () => ({
      accessToken: "facebook-token",
    });
    provider!.getUserInfo = async () => ({
      user: {
        id: accountId,
        ...mapOAuthProfile({
          providerId: "facebook",
          accountId,
          name: "Logout User",
          providerUsername: "logout_user",
        }),
        ...mapOAuthEmail({
          providerId: "facebook",
          accountId,
          email: `logout_${accountId}@example.local`,
          emailVerified: true,
        }),
      },
      data: {},
    });

    const start = await startOAuth(auth, {
      provider: "facebook",
      callbackURL: "/",
      newUserCallbackURL: "/onboarding",
      errorCallbackURL: "/login",
    });
    const authorizationURL = new URL(
      ((await start.json()) as { url: string }).url
    );
    const callback = await auth.handler(
      new Request(
        `${ORIGIN}/api/auth/callback/facebook?code=test&state=${authorizationURL.searchParams.get(
          "state"
        )}`,
        { headers: { cookie: stateCookie(start) } }
      )
    );
    expect(callback.status).toBe(302);

    const cookie = cookieHeader(callback);
    const user = await env.DB.prepare(
      `SELECT u.id
       FROM "user" u
       JOIN account a ON a.userId = u.id
       WHERE a.providerId = 'facebook' AND a.accountId = ?`
    )
      .bind(accountId)
      .first<{ id: string }>();
    expect(user?.id).toBeTruthy();

    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM session WHERE userId = ?`
    )
      .bind(user!.id)
      .first<{ count: number }>();
    expect(Number(before?.count ?? 0)).toBeGreaterThan(0);

    const active = await auth.handler(
      new Request(`${ORIGIN}/api/auth/get-session`, {
        headers: { Origin: ORIGIN, cookie },
      })
    );
    expect(active.status).toBe(200);
    expect(((await active.json()) as { user?: { id?: string } }).user?.id).toBe(
      user!.id
    );

    const signOut = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { Origin: ORIGIN, cookie },
      })
    );
    expect(signOut.status).toBe(200);

    const configuredCookieNames = new Set(
      Object.values(context.authCookies).map((cookieConfig) => cookieConfig.name)
    );
    const issuedSessionCookieNames = setCookiePairs(callback)
      .map(cookieName)
      .filter((name) => configuredCookieNames.has(name));
    const expiredCookieNames = new Set(setCookiePairs(signOut).map(cookieName));
    expect(issuedSessionCookieNames.length).toBeGreaterThan(0);
    for (const name of issuedSessionCookieNames) {
      expect(expiredCookieNames.has(name)).toBe(true);
    }

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM session WHERE userId = ?`
    )
      .bind(user!.id)
      .first<{ count: number }>();
    expect(Number(after?.count ?? 0)).toBe(0);

    const revoked = await auth.handler(
      new Request(
        `${ORIGIN}/api/auth/get-session?disableCookieCache=true`,
        { headers: { Origin: ORIGIN, cookie } }
      )
    );
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toBeNull();
  });
});
