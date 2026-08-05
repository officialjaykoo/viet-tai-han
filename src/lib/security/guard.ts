import { NextRequest } from "next/server";

import {
  ATK_COOKIE,
  SEC_COOKIE,
  MAX_CLOCK_SKEW_MS,
  buildCanonical,
  clientIpFromHeaders,
  consumeChallenge,
  openSecCookie,
  signCanonical,
  verifyPow,
} from "@/lib/security/challenge";
import {
  decodeInternalApiRequest,
  PROTOBUF_CONTENT_TYPE,
} from "@/lib/security/protobuf";
import { sha256Hex, timingSafeEqual } from "@/lib/security/crypto";
import { enforceApiMutateRateLimit } from "@/lib/rate-limit";
import { AuthError, getSession } from "@/lib/session";
import { getTunnelContext } from "@/lib/security/tunnel-context";
import { requirePublicApiKey } from "@/lib/public-api-auth";

export type GuardedBody = {
  json: unknown;
  raw: Uint8Array;
  ip: string;
};

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function verifyChallengeAndSignature(input: {
  request: NextRequest;
  method: string;
  path: string;
  query: string;
  payload: Uint8Array;
  challengeId: string;
  timestampMs: number;
  nonce: string;
  powNonce: number;
  signature: Uint8Array;
}): Promise<string> {
  const ip = clientIpFromHeaders(input.request.headers);
  const session = await getSession();
  await enforceApiMutateRateLimit({
    userId: session?.user?.id ?? null,
    ip,
  });

  const now = Date.now();
  if (Math.abs(now - input.timestampMs) > MAX_CLOCK_SKEW_MS) {
    throw new AuthError("Request timestamp out of range", 400);
  }
  if (!input.nonce || input.nonce.length < 16) {
    throw new AuthError("Invalid nonce", 400);
  }

  const cookieHeader = input.request.headers.get("cookie");
  const atk = readCookie(cookieHeader, ATK_COOKIE);
  const secSealed = readCookie(cookieHeader, SEC_COOKIE);
  const sec = await openSecCookie(secSealed);

  try {
    await consumeChallenge({
      challengeId: input.challengeId,
      atkCookie: atk,
      secCookie: sec,
      ip,
    });
  } catch (error) {
    throw new AuthError(
      error instanceof Error ? error.message : "Challenge failed",
      403
    );
  }

  if (!(await verifyPow(input.challengeId, input.powNonce))) {
    throw new AuthError("Proof-of-work failed", 403);
  }

  if (!atk) throw new AuthError("Missing API token cookie", 403);
  const payloadHash = await sha256Hex(input.payload);
  const canonical = buildCanonical({
    method: input.method,
    path: input.path,
    query: input.query,
    timestampMs: input.timestampMs,
    nonce: input.nonce,
    challengeId: input.challengeId,
    payloadHashHex: payloadHash,
    powNonce: input.powNonce,
  });
  const expectedSig = await signCanonical(atk, canonical);
  if (!timingSafeEqual(expectedSig, input.signature)) {
    throw new AuthError("Invalid request signature", 403);
  }
  return ip;
}

/**
 * App traffic should arrive via /i/api (tunnel context set).
 * Direct /api calls require a personal API key + JSON body.
 */
export async function requireSignedApiRequest(
  request: NextRequest,
  expectedMethod?: string
): Promise<GuardedBody> {
  const tunnel = getTunnelContext();
  if (tunnel?.verified) {
    return { json: tunnel.json, raw: tunnel.raw, ip: tunnel.ip };
  }

  // Public API: Bearer key + JSON (no browser cookie signing).
  const keyAuth = await requirePublicApiKey(request);
  const method = (expectedMethod ?? request.method).toUpperCase();
  if (method !== request.method.toUpperCase()) {
    throw new AuthError("Signed method mismatch", 400);
  }

  let json: unknown = null;
  let raw = new Uint8Array();
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await request.text();
    raw = new TextEncoder().encode(text);
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new AuthError("Invalid JSON payload", 400);
      }
    }
  } else if (contentType.includes(PROTOBUF_CONTENT_TYPE)) {
    // Legacy/direct protobuf against /api is rejected for public API.
    throw new AuthError("Use JSON with an API key on /api", 415);
  }

  return { json, raw, ip: keyAuth.ip };
}

/** Binary upload: tunnel context or public API multipart. */
export async function requireSignedHeaders(
  request: NextRequest
): Promise<{ ip: string }> {
  const tunnel = getTunnelContext();
  if (tunnel?.verified) {
    return { ip: tunnel.ip };
  }
  const keyAuth = await requirePublicApiKey(request);
  return { ip: keyAuth.ip };
}

export async function readApiJson(request: NextRequest): Promise<unknown> {
  const guarded = await requireSignedApiRequest(request);
  return guarded.json;
}

/** @deprecated kept for rare direct-protobuf callers during migration */
export async function requireLegacyProtobuf(
  request: NextRequest,
  expectedMethod?: string
): Promise<GuardedBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes(PROTOBUF_CONTENT_TYPE)) {
    throw new AuthError("Protobuf signed body required", 415);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 512_000) {
    throw new AuthError("Invalid request body", 400);
  }

  const atk = readCookie(request.headers.get("cookie"), ATK_COOKIE);
  let envelope;
  try {
    envelope = await decodeInternalApiRequest(bytes, atk);
  } catch {
    throw new AuthError("Malformed Protobuf envelope", 400);
  }

  const method = (expectedMethod ?? request.method).toUpperCase();
  if (envelope.method.toUpperCase() !== method) {
    throw new AuthError("Signed method mismatch", 400);
  }

  const url = new URL(request.url);
  if (envelope.path !== url.pathname) {
    throw new AuthError("Signed path mismatch", 400);
  }

  const ip = await verifyChallengeAndSignature({
    request,
    method,
    path: envelope.path,
    query: envelope.query,
    payload: envelope.payload,
    challengeId: envelope.challengeId,
    timestampMs: envelope.timestampMs,
    nonce: envelope.nonce,
    powNonce: envelope.powNonce,
    signature: envelope.signature,
  });

  let json: unknown = null;
  if (envelope.payload.byteLength > 0) {
    try {
      const text = new TextDecoder().decode(envelope.payload);
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new AuthError("Invalid JSON payload", 400);
    }
  }

  return { json, raw: envelope.payload, ip };
}
