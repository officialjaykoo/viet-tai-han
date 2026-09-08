export type AuthUiState =
  | "loading"
  | "authenticated"
  | "anonymous"
  | "unknown";

type SessionLike = {
  user?: unknown;
} | null | undefined;

type AuthErrorLike = {
  status?: number;
} | null | undefined;

/**
 * Keep transport failures out of the anonymous branch. A 401 is an
 * authoritative expired/revoked session response; other errors preserve a
 * neutral state unless a last-known session is still available.
 */
export function resolveAuthUiState(input: {
  hydrated: boolean;
  session: SessionLike;
  isPending: boolean;
  error: AuthErrorLike;
}): AuthUiState {
  if (!input.hydrated) return "loading";
  if (input.session?.user) return "authenticated";
  if (input.error && input.error.status !== 401) return "unknown";
  if (input.isPending) return "loading";
  return "anonymous";
}
