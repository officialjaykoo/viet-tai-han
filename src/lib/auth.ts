import { APIError, betterAuth } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import { createAuthEndpoint } from "@better-auth/core/api";
import { genericOAuth, username } from "better-auth/plugins";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import {
  createAvatarSeed,
  encodeGeneratedAvatar,
} from "@/lib/avatar";
import { mapOAuthEmail } from "@/lib/oauth-identity";

export type AppUserRole = "user" | "moderator" | "admin";
export type AppUserStatus = "active" | "banned" | "shadowbanned";
type AuthEnv = {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  VTH_AUTH_ORIGINS?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  ZALO_APP_ID?: string;
  ZALO_APP_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  RATE_LIMIT_ENABLED?: boolean;
};

type ZaloTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
};

type ZaloProfile = {
  id?: string;
  name?: string;
  picture?: { data?: { url?: string } };
};

function configuredOrigins(baseURL: string, extraOrigins?: string): string[] {
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    new URL(baseURL).origin,
    ...(extraOrigins?.split(",").map((origin) => origin.trim()).filter(Boolean) ??
      []),
  ].filter((origin, index, origins) => origins.indexOf(origin) === index);
}

function zaloOAuthConfig(env: AuthEnv) {
  if (!env.ZALO_APP_ID || !env.ZALO_APP_SECRET) return [];

  return [
    {
      providerId: "zalo",
      clientId: env.ZALO_APP_ID,
      clientSecret: env.ZALO_APP_SECRET,
      authorizationUrl: "https://oauth.zaloapp.com/v4/permission",
      tokenUrl: "https://oauth.zaloapp.com/v4/access_token",
      pkce: true,
      authorizationUrlParams: { app_id: env.ZALO_APP_ID },
      async getToken({
        code,
        codeVerifier,
      }: {
        code: string;
        codeVerifier?: string;
      }) {
        if (!codeVerifier) {
          throw new Error("Zalo OAuth requires a PKCE verifier");
        }

        const response = await fetch(
          "https://oauth.zaloapp.com/v4/access_token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              secret_key: env.ZALO_APP_SECRET!,
            },
            body: new URLSearchParams({
              code,
              app_id: env.ZALO_APP_ID!,
              grant_type: "authorization_code",
              code_verifier: codeVerifier,
            }),
          }
        );
        if (!response.ok) {
          throw new Error(`Zalo token exchange failed (${response.status})`);
        }

        const payload = (await response.json()) as ZaloTokenResponse;
        if (!payload.access_token) {
          throw new Error("Zalo token response did not include an access token");
        }

        const expiresIn = Number(payload.expires_in);
        return {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          accessTokenExpiresAt:
            Number.isFinite(expiresIn) && expiresIn > 0
              ? new Date(Date.now() + expiresIn * 1000)
              : undefined,
        };
      },
      async getUserInfo(tokens: { accessToken?: string }) {
        if (!tokens.accessToken) return null;

        const response = await fetch(
          "https://graph.zalo.me/v2.0/me?fields=id,name,picture",
          { headers: { access_token: tokens.accessToken } }
        );
        if (!response.ok) return null;

        const profile = (await response.json()) as ZaloProfile;
        if (!profile.id || !profile.name) return null;

        const emailFields = mapOAuthEmail({
          providerId: "zalo",
          accountId: profile.id,
          email: null,
        });

        return {
          id: profile.id,
          name: profile.name,
          ...emailFields,
          image: profile.picture?.data?.url,
        };
      },
    },
  ];
}


const TEMPORARY_USERNAME_PREFIX = "vth_user_";

async function createTemporaryUsername(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const candidate = `${TEMPORARY_USERNAME_PREFIX}${suffix}`;
    const existing = await db
      .prepare(`SELECT id FROM "user" WHERE username = ? COLLATE NOCASE`)
      .bind(candidate)
      .first<{ id: string }>();
    if (!existing) return candidate;
  }

  throw new Error("Could not allocate a temporary username");
}

function userFieldString(
  user: Record<string, unknown>,
  field: string
): string | null {
  const value = user[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function e2eSessionPlugin() {
  return {
    id: "e2e-session",
    endpoints: {
      e2eSession: createAuthEndpoint(
        "/e2e-session",
        { method: "POST" },
        async (ctx) => {
          const user = await ctx.context.internalAdapter.findUserById("user_alice");
          if (!user) {
            throw APIError.from("NOT_FOUND", {
              code: "E2E_USER_NOT_FOUND",
              message: "E2E user not found",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ success: true });
        }
      ),
    },
  };
}


function createAuthFromDb(db: D1Database, env: AuthEnv) {
  const kysely = new Kysely({
    dialect: new D1Dialect({ database: db }),
  });
  const baseURL = env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const facebookEnabled = Boolean(
    env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
  );
  const kakaoEnabled = Boolean(env.KAKAO_CLIENT_ID);

  return betterAuth({
    database: {
      db: kysely,
      type: "sqlite",
      // Better Auth default column names are camelCase (emailVerified, createdAt, …)
      transaction: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: configuredOrigins(baseURL, env.VTH_AUTH_ORIGINS),
    // Logical path only — browser never hits /api/auth directly; POST /i/api tunnels it.
    basePath: "/api/auth",
    socialProviders: {
      ...(facebookEnabled
        ? {
            facebook: {
              clientId: env.FACEBOOK_CLIENT_ID!,
              clientSecret: env.FACEBOOK_CLIENT_SECRET!,
              scope: ["email", "public_profile"],
              mapProfileToUser: (profile) =>
                mapOAuthEmail({
                  providerId: "facebook",
                  accountId: profile.id,
                  email: profile.email,
                  emailVerified: profile.email_verified,
                }),
            },
          }
        : {}),
      ...(kakaoEnabled
        ? {
            kakao: {
              clientId: env.KAKAO_CLIENT_ID!,
              clientSecret: env.KAKAO_CLIENT_SECRET,
              // Email is optional; only request profile data from Kakao.
              disableDefaultScope: true,
              scope: ["profile_image", "profile_nickname"],
              mapProfileToUser: (profile) =>
                mapOAuthEmail({
                  providerId: "kakao",
                  accountId: String(profile.id),
                  email: profile.kakao_account?.email,
                  emailVerified:
                    profile.kakao_account?.is_email_valid === true &&
                    profile.kakao_account?.is_email_verified === true,
                }),
            },
          }
        : {}),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["facebook", "kakao", "zalo"],
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    disabledPaths: [
      "/sign-in/username",
      "/sign-in/email",
      "/sign-up/email",
      "/change-password",
      "/set-password",
      "/request-password-reset",
      "/reset-password",
      "/verify-password",
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    user: {
      additionalFields: {
        contactEmail: {
          type: "string",
          required: false,
          input: true,
          returned: false,
        },
        contactEmailVerified: {
          type: "boolean",
          defaultValue: false,
          required: false,
          input: false,
          returned: false,
        },
        onboardingComplete: {
          type: "boolean",
          defaultValue: false,
          required: false,
          input: false,
        },
        karma: {
          type: "number",
          defaultValue: 0,
          required: false,
          input: false,
        },
        postKarma: {
          type: "number",
          defaultValue: 0,
          required: false,
          input: false,
        },
        commentKarma: {
          type: "number",
          defaultValue: 0,
          required: false,
          input: false,
        },
        role: {
          type: "string",
          defaultValue: "user",
          required: false,
          input: false,
        },
        status: {
          type: "string",
          defaultValue: "active",
          required: false,
          input: false,
        },
        bio: {
          type: "string",
          required: false,
        },
        isNsfw: {
          type: "boolean",
          defaultValue: false,
          required: false,
          input: false,
        },
        preferredLanguage: {
          type: "string",
          defaultValue: "unknown",
          required: false,
          input: false,
        },
        theme: {
          type: "string",
          defaultValue: "system",
          required: false,
          input: false,
        },
        bannerKey: {
          type: "string",
          required: false,
          input: false,
        },
        showNsfw: {
          type: "boolean",
          defaultValue: false,
          required: false,
          input: false,
        },
        allowDms: {
          type: "string",
          defaultValue: "anyone",
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 24,
        usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
      }),
      genericOAuth({ config: zaloOAuthConfig(env) }),
      ...(process.env.E2E_BOT_BYPASS === "1" ? [e2eSessionPlugin()] : []),
    ],
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED ?? true,
      window: 60,
      max: 40,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const currentUsername = userFieldString(
              user as Record<string, unknown>,
              "username"
            );
            const assignedUsername =
              currentUsername ?? (await createTemporaryUsername(db));
            const displayUsername =
              userFieldString(
                user as Record<string, unknown>,
                "displayUsername"
              ) ?? assignedUsername;

            return {
              data: {
                ...user,
                username: assignedUsername,
                displayUsername,
                image:
                  user.image ?? encodeGeneratedAvatar(createAvatarSeed()),
              },
            };
          },
        },
      },
    account: {
      delete: {
        before: async (account, context) => {
          const path = context?.path;
          if (
            path &&
            path !== "/unlink-account" &&
            path !== "/api/auth/unlink-account"
          ) {
            return;
          }
          if (account.providerId === "credential") return;

          const result = await db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM account
               WHERE userId = ? AND providerId <> 'credential'`
            )
            .bind(account.userId)
            .first<{ count: number | string }>();
          if (Number(result?.count ?? 0) <= 1) {
            throw APIError.from("BAD_REQUEST", {
              code: "LAST_SOCIAL_ACCOUNT",
              message: "At least one social account must remain connected",
            });
          }
        },
      },
    },
    },
  });
}

export type Auth = ReturnType<typeof createAuthFromDb>;

let authSingleton: Auth | null = null;

/** Request-scoped auth instance bound to the current D1 database. */
export async function getAuth(): Promise<Auth> {
  const { env } = await getCloudflareContext({ async: true });

  if (!authSingleton) {
    authSingleton = createAuthFromDb(env.DB, {
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      VTH_AUTH_ORIGINS: env.VTH_AUTH_ORIGINS,
      FACEBOOK_CLIENT_ID: env.FACEBOOK_CLIENT_ID,
      FACEBOOK_CLIENT_SECRET: env.FACEBOOK_CLIENT_SECRET,
      ZALO_APP_ID: env.ZALO_APP_ID,
      ZALO_APP_SECRET: env.ZALO_APP_SECRET,
      KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
      KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
      RATE_LIMIT_ENABLED:
        process.env.E2E_BOT_BYPASS === "1" ? false : undefined,
    });
  }

  return authSingleton;
}

/** Test/helper factory that does not rely on OpenNext context. */
export function createAuth(db: D1Database, env: AuthEnv = {}) {
  return createAuthFromDb(db, {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "dev-secret-must-be-at-least-32-chars!!",
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
    VTH_AUTH_ORIGINS: env.VTH_AUTH_ORIGINS,
    FACEBOOK_CLIENT_ID: env.FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET: env.FACEBOOK_CLIENT_SECRET,
    ZALO_APP_ID: env.ZALO_APP_ID,
    ZALO_APP_SECRET: env.ZALO_APP_SECRET,
    KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
    KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
    RATE_LIMIT_ENABLED: false,
  });
}
