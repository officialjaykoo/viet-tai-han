import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import {
  createAvatarSeed,
  encodeGeneratedAvatar,
} from "@/lib/avatar";

export type AppUserRole = "user" | "moderator" | "admin";
export type AppUserStatus = "active" | "banned" | "shadowbanned";

function createAuthFromDb(db: D1Database, env: {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}) {
  const kysely = new Kysely({
    dialect: new D1Dialect({ database: db }),
  });

  return betterAuth({
    database: {
      db: kysely,
      type: "sqlite",
      // Better Auth default column names are camelCase (emailVerified, createdAt, …)
      transaction: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trustedOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3100",
      "http://127.0.0.1:3100",
      // Add the verified production origin before deployment, e.g. "https://vth.kr"
    ],
    // Logical path only — browser never hits /api/auth directly; POST /i/api tunnels it.
    basePath: "/api/auth",
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
    });
  }

  return authSingleton;
}

/** Test/helper factory that does not rely on OpenNext context. */
export function createAuth(db: D1Database, env: {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
} = {}) {
  return createAuthFromDb(db, {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "dev-secret-must-be-at-least-32-chars!!",
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });
}
