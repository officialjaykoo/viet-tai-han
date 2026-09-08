import { AuthError } from "@/lib/session";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AuthError("JSON object payload required", 400);
  }
  return value as JsonObject;
}

function optionalString(record: JsonObject, field: string): string | undefined {
  if (!(field in record)) return undefined;
  const value = record[field];
  if (typeof value !== "string") {
    throw new AuthError(`${field} must be a string`, 400);
  }
  return value;
}

export function parseFriendActionPayload(value: unknown): {
  action?: string;
  requestId?: string;
  userId?: string;
} {
  const record = asObject(value);
  return {
    action: optionalString(record, "action"),
    requestId: optionalString(record, "requestId"),
    userId: optionalString(record, "userId"),
  };
}

export function parseUserActionPayload(value: unknown): {
  action?: string;
  reason?: string;
  details?: string;
} {
  const record = asObject(value);
  return {
    action: optionalString(record, "action"),
    reason: optionalString(record, "reason"),
    details: optionalString(record, "details"),
  };
}

export function parseChatRequestActionPayload(value: unknown): {
  action?: string;
} {
  const record = asObject(value);
  return { action: optionalString(record, "action") };
}
