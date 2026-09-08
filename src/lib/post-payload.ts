import { AuthError } from "@/lib/session";

export type CreatePostPayload = {
  subreddit: string;
  title: string;
  body?: string | null;
  url?: string | null;
  mediaKey?: string | null;
  requestId?: string | null;
};

export type EditPostPayload = {
  title?: string;
  body?: string | null;
  url?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthError("Invalid post payload", 400);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuthError("Invalid post payload", 400);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  allowNull = true
): string | null | undefined {
  if (!(field in record)) return undefined;
  const value = record[field];
  if (value === null && allowNull) return null;
  if (typeof value !== "string") {
    throw new AuthError("Invalid post payload", 400);
  }
  return value;
}

function optionalNonNullString(
  record: Record<string, unknown>,
  field: string
): string | undefined {
  if (!(field in record)) return undefined;
  const value = record[field];
  if (typeof value !== "string") {
    throw new AuthError("Invalid post payload", 400);
  }
  return value;
}

export function parseCreatePostPayload(value: unknown): CreatePostPayload {
  const record = asRecord(value);
  return {
    subreddit: requiredString(record, "subreddit"),
    title: requiredString(record, "title"),
    body: optionalString(record, "body"),
    url: optionalString(record, "url"),
    mediaKey: optionalString(record, "mediaKey"),
    requestId: optionalString(record, "requestId"),
  };
}

export function parseEditPostPayload(value: unknown): EditPostPayload {
  const record = asRecord(value);
  return {
    title: optionalNonNullString(record, "title"),
    body: optionalString(record, "body"),
    url: optionalString(record, "url"),
  };
}
