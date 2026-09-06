import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createAuth } from "@/lib/auth";
import {
  createSyntheticOAuthEmail,
  mapOAuthEmail,
  mapOAuthProfile,
} from "@/lib/oauth-identity";
async function startOAuth(
  auth: ReturnType<typeof createAuth>,
  path: string,
  body: Record<string, unknown>,
  cookie?: string
) {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        ...(cookie ? { cookie } : {}),
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

function stateCookie(response: Response): string {
  const pair = setCookiePairs(response).find((value) =>
    value.toLowerCase().includes("state=")
  );
  if (!pair) throw new Error("OAuth state cookie was not set");
  return pair;
}

function redirectPath(response: Response): string {
  const location = response.headers.get("location");
  if (!location) throw new Error("OAuth response did not include a location");
  return new URL(location, "http://localhost:3000").pathname;
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
      `SELECT username FROM "user" WHERE id = ?`
    )
      .bind(userId)
      .first<{ username: string }>();

    expect(row?.username).toMatch(/^vth_user_[a-f0-9]{12}$/);
  });
  it("persists a real Facebook email and sends new users to onboarding", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });
    const context = await auth.$context;
    const provider = context.socialProviders.find(
      (candidate) => candidate.id === "facebook"
    );
    expect(provider).toBeDefined();

    const accountId = `facebook_${crypto.randomUUID()}`;
    const mappedEmail = mapOAuthEmail({
      providerId: "facebook",
      accountId,
      email: "Person@Example.com",
      emailVerified: true,
    });
    provider!.validateAuthorizationCode = async () => ({
      accessToken: "facebook-token",
    });
    provider!.getUserInfo = async () => ({
      user: {
        id: accountId,
        ...mapOAuthProfile({
          providerId: "facebook",
          accountId,
          name: "Facebook User",
          providerUsername: "facebook_handle",
        }),
        ...mappedEmail,
      },
      data: {},
    });

    const start = await startOAuth(auth, "sign-in/social", {
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
        `http://localhost:3000/api/auth/callback/facebook?code=test&state=${authorizationURL.searchParams.get(
          "state"
        )}`,
        { headers: { cookie: stateCookie(start) } }
      )
    );
    const row = await env.DB.prepare(
      `SELECT u.email, u.contactEmail, u.onboardingComplete,
              u.onboardingUsernameCandidate
       FROM "user" u
       JOIN account a ON a.userId = u.id
       WHERE a.providerId = 'facebook' AND a.accountId = ?`
    )
      .bind(accountId)
      .first<{
        email: string;
        contactEmail: string | null;
        onboardingComplete: number;
        onboardingUsernameCandidate: string | null;
      }>();

    expect(row).toMatchObject({
      email: "person@example.com",
      contactEmail: "person@example.com",
      onboardingComplete: 0,
    });
    expect(row?.onboardingUsernameCandidate).toBe("facebook_handle");
  });

  it("allows duplicate onboarding candidates across OAuth callbacks", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });
    const context = await auth.$context;
    const provider = context.socialProviders.find(
      (candidate) => candidate.id === "facebook"
    );
    expect(provider).toBeDefined();

    let accountId = `facebook_${crypto.randomUUID()}`;
    provider!.validateAuthorizationCode = async () => ({
      accessToken: "facebook-token",
    });
    provider!.getUserInfo = async () => ({
      user: {
        id: accountId,
        ...mapOAuthProfile({
          providerId: "facebook",
          accountId,
          name: "Same OAuth Name",
          providerUsername: "same_oauth_candidate",
        }),
        ...mapOAuthEmail({
          providerId: "facebook",
          accountId,
          email: null,
        }),
      },
      data: {},
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      accountId = `facebook_${crypto.randomUUID()}`;
      const start = await startOAuth(auth, "sign-in/social", {
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
          `http://localhost:3000/api/auth/callback/facebook?code=test&state=${authorizationURL.searchParams.get(
            "state"
          )}`,
          { headers: { cookie: stateCookie(start) } }
        )
      );
      expect(callback.status).toBe(302);
      expect(redirectPath(callback)).toBe("/onboarding");
    }

    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM "user"
       WHERE onboardingUsernameCandidate = 'same_oauth_candidate'`
    ).first<{ count: number }>();
    expect(count?.count).toBe(2);
  });
  it("creates and reuses a Kakao identity without an email", async () => {
    const auth = createAuth(env.DB, {
      KAKAO_CLIENT_ID: "kakao-client",
      KAKAO_CLIENT_SECRET: "kakao-secret",
    });
    const context = await auth.$context;
    const provider = context.socialProviders.find(
      (candidate) => candidate.id === "kakao"
    );
    expect(provider).toBeDefined();

    const accountId = String(
      Number.parseInt(crypto.randomUUID().slice(0, 8), 16)
    );
    provider!.validateAuthorizationCode = async () => ({
      accessToken: "kakao-token",
    });

    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.startsWith("https://kapi.kakao.com/v2/user/me")) {
          return Response.json({
            id: Number(accountId),
            kakao_account: {
              profile: { nickname: "Kakao User" },
            },
          });
        }
        return originalFetch(input, init);
      });

    async function finish(start: Response) {
      const authorizationURL = new URL(
        ((await start.clone().json()) as { url: string }).url
      );
      return auth.handler(
        new Request(
          `http://localhost:3000/api/auth/callback/kakao?code=test&state=${authorizationURL.searchParams.get(
            "state"
          )}`,
          { headers: { cookie: stateCookie(start) } }
        )
      );
    }

    try {
      const start = await startOAuth(auth, "sign-in/social", {
        provider: "kakao",
        callbackURL: "/",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/login",
      });
      const firstCallback = await finish(start);
      expect(firstCallback.status).toBe(302);
      expect(redirectPath(firstCallback)).toBe("/onboarding");

      const email = createSyntheticOAuthEmail("kakao", accountId);
      const firstUser = await env.DB.prepare(
        `SELECT id, email, contactEmail, onboardingComplete
         FROM "user" WHERE email = ?`
      )
        .bind(email)
        .first<{
          id: string;
          email: string;
          contactEmail: string | null;
          onboardingComplete: number;
        }>();
      expect(firstUser).toMatchObject({
        email,
        contactEmail: null,
        onboardingComplete: 0,
      });

      const secondStart = await startOAuth(auth, "sign-in/social", {
        provider: "kakao",
        callbackURL: "/",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/login",
      });
      const secondCallback = await finish(secondStart);
      expect(secondCallback.status).toBe(302);
      expect(redirectPath(secondCallback)).toBe("/");

      const counts = await env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM "user" WHERE email = ?) AS users,
           (SELECT COUNT(*) FROM account
            WHERE providerId = 'kakao' AND accountId = ?) AS accounts`
      )
        .bind(email, accountId)
        .first<{ users: number; accounts: number }>();
      expect(counts).toEqual({ users: 1, accounts: 1 });
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("creates a Zalo identity without an email", async () => {
    const auth = createAuth(env.DB, {
      ZALO_APP_ID: "zalo-app",
      ZALO_APP_SECRET: "zalo-secret",
    });
    const accountId = `zalo_${crypto.randomUUID()}`;
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "https://oauth.zaloapp.com/v4/access_token") {
          return Response.json({ access_token: "zalo-token" });
        }
        if (url.startsWith("https://graph.zalo.me/v2.0/me")) {
          return Response.json({ id: accountId });
        }
        return originalFetch(input, init);
      });

    try {
      const start = await startOAuth(auth, "sign-in/oauth2", {
        providerId: "zalo",
        callbackURL: "/",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/login",
      });
      const authorizationURL = new URL(
        ((await start.clone().json()) as { url: string }).url
      );
      const callback = await auth.handler(
        new Request(
          `http://localhost:3000/api/auth/oauth2/callback/zalo?code=test&state=${authorizationURL.searchParams.get(
            "state"
          )}`,
          { headers: { cookie: stateCookie(start) } }
        )
      );

      expect(callback.status).toBe(302);
      expect(redirectPath(callback)).toBe("/onboarding");

      const email = createSyntheticOAuthEmail("zalo", accountId);
      const row = await env.DB.prepare(
        `SELECT u.email, u.contactEmail, u.name,
                u.onboardingUsernameCandidate
         FROM "user" u
         JOIN account a ON a.userId = u.id
         WHERE a.providerId = 'zalo' AND a.accountId = ?`
      )
        .bind(accountId)
        .first<{
          email: string;
          contactEmail: string | null;
          name: string;
          onboardingUsernameCandidate: string | null;
        }>();
      expect(row).toMatchObject({
        email,
        contactEmail: null,
        name: "VTH User",
      });
      expect(row?.onboardingUsernameCandidate).toMatch(
        /^vth_[a-f0-9]{12}$/
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("does not auto-link a new provider account by matching email", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });
    const context = await auth.$context;
    const provider = context.socialProviders.find(
      (candidate) => candidate.id === "facebook"
    );
    expect(provider).toBeDefined();

    const existingUserId = `same_email_${crypto.randomUUID()}`;
    const accountId = `facebook_${crypto.randomUUID()}`;
    const email = `${existingUserId}@example.com`;
    await context.internalAdapter.createUser({
      id: existingUserId,
      name: "Existing User",
      email,
      emailVerified: true,
      image: null,
    });
    provider!.validateAuthorizationCode = async () => ({
      accessToken: "facebook-token",
    });
    provider!.getUserInfo = async () => ({
      user: {
        id: accountId,
        name: "New Facebook Profile",
        email,
        emailVerified: true,
      },
      data: {},
    });

    const start = await startOAuth(auth, "sign-in/social", {
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
        `http://localhost:3000/api/auth/callback/facebook?code=test&state=${authorizationURL.searchParams.get(
          "state"
        )}`,
        { headers: { cookie: stateCookie(start) } }
      )
    );

    const location = new URL(
      callback.headers.get("location")!,
      "http://localhost:3000"
    );
    expect(callback.status).toBe(302);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("account_not_linked");

    const account = await env.DB.prepare(
      `SELECT id FROM account WHERE providerId = 'facebook' AND accountId = ?`
    )
      .bind(accountId)
      .first<{ id: string }>();
    expect(account).toBeNull();
  });

  it("explicitly links an email-less Kakao account to the current session", async () => {
    const auth = createAuth(env.DB, {
      FACEBOOK_CLIENT_ID: "facebook-client",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
      KAKAO_CLIENT_ID: "kakao-client",
      KAKAO_CLIENT_SECRET: "kakao-secret",
    });
    const context = await auth.$context;
    const facebook = context.socialProviders.find(
      (candidate) => candidate.id === "facebook"
    );
    const kakao = context.socialProviders.find(
      (candidate) => candidate.id === "kakao"
    );
    expect(facebook).toBeDefined();
    expect(kakao).toBeDefined();

    const facebookAccountId = `facebook_${crypto.randomUUID()}`;
    const kakaoAccountId = String(
      Number.parseInt(crypto.randomUUID().slice(0, 8), 16)
    );
    facebook!.validateAuthorizationCode = async () => ({
      accessToken: "facebook-token",
    });
    facebook!.getUserInfo = async () => ({
      user: {
        id: facebookAccountId,
        name: "Link Owner",
        ...mapOAuthEmail({
          providerId: "facebook",
          accountId: facebookAccountId,
          email: "link-owner@example.com",
          emailVerified: true,
        }),
      },
      data: {},
    });
    kakao!.validateAuthorizationCode = async () => ({
      accessToken: "kakao-token",
    });
    kakao!.getUserInfo = async () => ({
      user: {
        id: Number(kakaoAccountId),
        name: "Linked Kakao",
        ...mapOAuthEmail({
          providerId: "kakao",
          accountId: kakaoAccountId,
          email: null,
        }),
      },
      data: {},
    });

    const signInStart = await startOAuth(auth, "sign-in/social", {
      provider: "facebook",
      callbackURL: "/",
      newUserCallbackURL: "/",
      errorCallbackURL: "/login",
    });
    const signInURL = new URL(
      ((await signInStart.clone().json()) as { url: string }).url
    );
    const signInCallback = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/callback/facebook?code=test&state=${signInURL.searchParams.get(
          "state"
        )}`,
        { headers: { cookie: stateCookie(signInStart) } }
      )
    );
    expect(signInCallback.status).toBe(302);
    const sessionCookie = cookieHeader(signInCallback);
    expect(sessionCookie).not.toBe("");

    const linkStart = await startOAuth(
      auth,
      "link-social",
      {
        provider: "kakao",
        callbackURL: "/settings?section=account",
        errorCallbackURL: "/settings?section=account",
      },
      sessionCookie
    );
    expect(linkStart.status).toBe(200);
    const linkURL = new URL(
      ((await linkStart.clone().json()) as { url: string }).url
    );
    const linkCallback = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/callback/kakao?code=test&state=${linkURL.searchParams.get(
          "state"
        )}`,
        {
          headers: {
            cookie: `${stateCookie(linkStart)}; ${sessionCookie}`,
          },
        }
      )
    );

    expect(linkCallback.status).toBe(302);
    const linkLocation = new URL(
      linkCallback.headers.get("location")!,
      "http://localhost:3000"
    );
    expect(linkLocation.pathname).toBe("/settings");
    expect(linkLocation.searchParams.get("section")).toBe("account");

    const linked = await env.DB.prepare(
      `SELECT a.userId, u.email, u.contactEmail
       FROM account a
       JOIN "user" u ON u.id = a.userId
       WHERE a.providerId = 'kakao' AND a.accountId = ?`
    )
      .bind(kakaoAccountId)
      .first<{
        userId: string;
        email: string;
        contactEmail: string | null;
      }>();
    expect(linked).toMatchObject({
      email: "link-owner@example.com",
      contactEmail: "link-owner@example.com",
    });

    const accountCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM account WHERE userId = ?`
    )
      .bind(linked?.userId)
      .first<{ count: number }>();
    expect(accountCount?.count).toBe(2);
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
      "update-user",
      "is-username-available",
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

  it("starts Kakao OAuth with the configured callback", async () => {
    const auth = createAuth(env.DB, {
      KAKAO_CLIENT_ID: "kakao-client",
      KAKAO_CLIENT_SECRET: "kakao-secret",
    });
    const response = await startOAuth(auth, "sign-in/social", {
      provider: "kakao",
      callbackURL: "/settings?section=account",
    });
    const payload = (await response.json()) as { url?: string };

    expect(response.status).toBe(200);
    const authorizationURL = new URL(payload.url!);
    expect(authorizationURL.origin + authorizationURL.pathname).toBe(
      "https://kauth.kakao.com/oauth/authorize"
    );
    expect(authorizationURL.searchParams.get("client_id")).toBe(
      "kakao-client"
    );
    expect(authorizationURL.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/kakao"
    );
    const scope = authorizationURL.searchParams.get("scope") ?? "";
    expect(scope.split(" ")).toEqual(
      expect.arrayContaining(["profile_image", "profile_nickname"])
    );
    expect(scope.split(" ")).not.toContain("account_email");
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
