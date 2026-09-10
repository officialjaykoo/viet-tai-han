import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

import { apiFetch } from "@/lib/api-client";

const API_GUARD_COOKIES = ["red_atk", "red_qn", "red_qv"] as const;

function isSessionRequest(url: string): boolean {
  try {
    return new URL(url, window.location.origin).pathname.endsWith("/get-session");
  } catch {
    return false;
  }
}

function clearStaleApiGuard() {
  if (typeof document === "undefined") return;

  for (const name of API_GUARD_COOKIES) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

async function fetchAuth(input: string, init?: RequestInit): Promise<Response> {
  const response = await apiFetch(input, init);
  if (response.status !== 403 || !isSessionRequest(input)) return response;

  // A stale ATK/route gate is recoverable for the guest session probe.
  clearStaleApiGuard();
  return apiFetch(input, init);
}

/**
 * All Better Auth traffic goes through POST /i/api (Protobuf).
 * Logical paths remain /api/auth/* inside the envelope only.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: true,
    refetchWhenOffline: false,
  },
  fetchOptions: {
    customFetchImpl: (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return fetchAuth(url, init);
    },
  },
  plugins: [genericOAuthClient()],
});

export type AuthSession = typeof authClient.$Infer.Session;
export type PublicAuthSession = Omit<AuthSession, "user"> & {
  user: Omit<
    AuthSession["user"],
    "email" | "onboardingUsernameCandidate" | "usernameChangedAt"
  >;
};

let initialSessionHydrated = false;

/**
 * Better Auth 1.6.26 exposes the session atom through its public client store,
 * but does not expose the newer hydrateSession helper. Seed that same atom
 * before its mount fetch so every client auth consumer shares one state.
 */
export function hydrateSession(initialSession: PublicAuthSession | null) {
  if (
    typeof window === "undefined" ||
    !initialSession ||
    initialSessionHydrated
  ) {
    return;
  }

  const sessionAtom = authClient.$store.atoms.session;
  const current = sessionAtom.get();
  if (current.data !== null) {
    initialSessionHydrated = true;
    return;
  }

  sessionAtom.set({
    ...current,
    data: initialSession,
    error: null,
    isPending: false,
    isRefetching: false,
  });
  initialSessionHydrated = true;
}

export const { signIn, signOut, useSession } = authClient;
