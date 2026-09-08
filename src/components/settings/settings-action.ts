import { apiFetch } from "@/lib/api-client";

export class SettingsRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SettingsRequestError";
    this.status = status;
  }
}

function responseError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : null;
}

export async function settingsRequest<T>(
  input: string,
  init: RequestInit,
  fallback: string
): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(input, init);
  } catch {
    throw new SettingsRequestError(fallback, 0);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The status below still determines failure; successful malformed JSON is
    // rejected rather than reported as a false success.
  }

  const payloadError = responseError(payload);
  if (!response.ok) {
    throw new SettingsRequestError(
      payloadError ?? fallback,
      response.status
    );
  }
  if (payloadError) {
    throw new SettingsRequestError(payloadError, response.status);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SettingsRequestError(fallback, response.status);
  }
  return payload as T;
}

export function settingsErrorMessage(
  error: unknown,
  localize: (message: string | null | undefined, fallback?: string) => string,
  fallback: string
): string {
  if (error instanceof SettingsRequestError && error.status === 0) {
    return fallback;
  }
  return localize(error instanceof Error ? error.message : null, fallback);
}

export function authErrorMessage(
  error: unknown,
  localize: (message: string | null | undefined, fallback?: string) => string,
  fallback: string
): string {
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return localize(typeof message === "string" ? message : null, fallback);
}
