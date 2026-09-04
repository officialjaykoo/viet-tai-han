import { betterAuth } from "better-auth";
import { genericOAuth, username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import {
  createAvatarSeed,
  encodeGeneratedAvatar,
} from "@/lib/avatar";

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

        return {
          id: profile.id,
          name: profile.name,
          email: `zalo-${profile.id}@oauth.viet-tai-han.invalid`,
          emailVerified: false,
          image: profile.picture?.data?.url,
        };
      },
    },
  ];
}


function createAuthFromDb(db: D1Database, env: AuthEnv) {
  const kysely = new Kysely({
    dialect: new D1Dialect({ database: db }),
  });
  const baseURL = env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const facebookEnabled = Boolean(
    env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
  );


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
    socialProviders: facebookEnabled
      ? {
          facebook: {
            clientId: env.FACEBOOK_CLIENT_ID!,
            clientSecret: env.FACEBOOK_CLIENT_SECRET!,
            scope: ["email", "public_profile"],
          },
        }
      : {},
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
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
      passkey({
        rpID: new URL(baseURL).hostname,
        rpName: "Việt tại Hàn",
        origin: configuredOrigins(baseURL, env.VTH_AUTH_ORIGINS),
      }),
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 40,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (user.image) {
              return { data: user };
            }
            return {
              data: {
                ...user,
                image: encodeGeneratedAvatar(createAvatarSeed()),
              },
            };
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
  });
}
