import type { LikeMutation } from "@/lib/types";
import { AuthError } from "@/lib/session";

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthError(message, 400);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  message: string
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuthError(message, 400);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  message: string
): string | null | undefined {
  if (!(field in record)) return undefined;
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== "string") throw new AuthError(message, 400);
  return value;
}

export type LikePayload = { action: LikeMutation };

export function parseLikePayload(value: unknown): LikePayload {
  const message = "Invalid like payload";
  const record = asRecord(value, message);
  const action = record.action;
  if (action !== "like" && action !== "unlike") {
    throw new AuthError(message, 400);
  }
  return { action };
}

export type CommentPayload = {
  body: string;
  parentId?: string | null;
  requestId?: string | null;
};

export function parseCommentPayload(value: unknown): CommentPayload {
  const message = "Invalid comment payload";
  const record = asRecord(value, message);
  return {
    body: requiredString(record, "body", message),
    parentId: optionalString(record, "parentId", message),
    requestId: optionalString(record, "requestId", message),
  };
}

export type QuestionPayload = {
  community: string;
  title: string;
  body: string;
  requestId?: string | null;
};

export function parseQuestionPayload(value: unknown): QuestionPayload {
  const message = "Invalid question payload";
  const record = asRecord(value, message);
  return {
    community: requiredString(record, "community", message),
    title: requiredString(record, "title", message),
    body: requiredString(record, "body", message),
    requestId: optionalString(record, "requestId", message),
  };
}

export type AnswerPayload = { body: string; requestId?: string | null };

export function parseAnswerPayload(value: unknown): AnswerPayload {
  const message = "Invalid answer payload";
  const record = asRecord(value, message);
  return {
    body: requiredString(record, "body", message),
    requestId: optionalString(record, "requestId", message),
  };
}

export type AcceptAnswerPayload = { answerId: string };

export function parseAcceptAnswerPayload(value: unknown): AcceptAnswerPayload {
  const message = "Invalid accept-answer payload";
  const record = asRecord(value, message);
  return { answerId: requiredString(record, "answerId", message) };
}
export type ListingPayload = {
  kind: string;
  category: string;
  title: string;
  body: string;
  price?: string | null;
  location: string;
  requestId?: string | null;
};

export function parseListingPayload(value: unknown): ListingPayload {
  const message = "Invalid listing payload";
  const record = asRecord(value, message);
  return {
    kind: requiredString(record, "kind", message),
    category: requiredString(record, "category", message),
    title: requiredString(record, "title", message),
    body: requiredString(record, "body", message),
    price: optionalString(record, "price", message),
    location: requiredString(record, "location", message),
    requestId: optionalString(record, "requestId", message),
  };
}
