import { AuthError } from "@/lib/session";

const MAX_REQUEST_ID_LENGTH = 120;

/** Normalize a client request ID used to deduplicate a retried write. */
export function normalizeRequestId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new AuthError("Invalid request ID", 400);
  }
  const requestId = value.trim();
  if (!requestId) return null;
  if (requestId.length > MAX_REQUEST_ID_LENGTH) {
    throw new AuthError("Request ID is too long", 400);
  }
  return requestId;
}

export function requestIdFromHeaders(headers: Headers): string | null {
  return normalizeRequestId(
    headers.get("Idempotency-Key") ?? headers.get("X-Request-ID")
  );
}
