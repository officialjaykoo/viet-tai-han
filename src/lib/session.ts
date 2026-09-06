import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n/server";
import { jsonPublicError } from "@/lib/public-error";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getSession() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;

  const {
    email: _email,
    onboardingUsernameCandidate: _candidate,
    usernameChangedAt: _usernameChangedAt,
    ...user
  } = session.user as typeof session.user & {
    onboardingUsernameCandidate?: string | null;
    usernameChangedAt?: string | null;
  };
  return { ...session, user };
}

/**
 * Require a signed-in, non-banned user for mutating actions.
 * Shadowbanned users may still act (their content is hidden from others).
 * Incomplete accounts are limited to the onboarding flow unless explicitly
 * allowed by the caller.
 */
export async function requireSession(options: { allowIncomplete?: boolean } = {}) {
  const session = await getSession();

  if (!session?.user) {
    throw new AuthError("Sign in to continue", 401);
  }

  const status = (session.user as { status?: string }).status ?? "active";
  if (status === "banned") {
    throw new AuthError("This account can't do that", 403);
  }

  if (!options.allowIncomplete) {
    const { getOnboardingState } = await import("@/lib/onboarding");
    const onboarding = await getOnboardingState(session.user.id);
    if (!onboarding?.onboardingComplete) {
      throw new AuthError("Complete onboarding before continuing", 409);
    }
  }

  return session;
}

export async function jsonAuthError(error: unknown) {
  const { locale } = await getRequestLocale();
  if (error instanceof AuthError) {
    return jsonPublicError(error, "Request failed", undefined, locale);
  }
  throw error;
}
