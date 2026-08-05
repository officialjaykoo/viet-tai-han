import { NextRequest } from "next/server";

import { dispatchInternalApi } from "@/lib/internal-api/dispatch";
import {
  protobufAuthError,
  protobufJsonError,
  wrapAsProtobufResponse,
} from "@/lib/internal-api/protobuf-response";
import {
  decodeInternalApiRequest,
  PROTOBUF_CONTENT_TYPE,
} from "@/lib/security/protobuf";
import { fakeNotFoundResponse } from "@/lib/http-errors";
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
  verifyRouteGate,
} from "@/lib/security/challenge";
import { sha256Hex, timingSafeEqual } from "@/lib/security/crypto";
import { enforceApiMutateRateLimit, enforceApiReadRateLimit } from "@/lib/rate-limit";
import { AuthError, getSession } from "@/lib/session";
import { runWithTunnelContext } from "@/lib/security/tunnel-context";

export const dynamic = "force-dynamic";

const BOOTSTRAP_PATHS = new Set(["/api/security/challenge"]);

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function isBootstrap(method: string, path: string): boolean {
  return method === "GET" && BOOTSTRAP_PATHS.has(path);
}

async function verifyEnvelope(
  request: NextRequest,
  envelope: Awaited<ReturnType<typeof decodeInternalApiRequest>>
): Promise<{ ip: string; atk: string | null; bootstrap: boolean }> {
  const method = envelope.method.toUpperCase();
  const path = envelope.path;
  const ip = clientIpFromHeaders(request.headers);

  if (!path.startsWith("/api/") || path.includes("..")) {
    throw new AuthError("Invalid path", 400);
  }

  if (isBootstrap(method, path)) {
    return { ip, atk: null, bootstrap: true };
  }

  const cookieHeader = request.headers.get("cookie");
  const atk = readCookie(cookieHeader, ATK_COOKIE);
  if (!atk) throw new AuthError("Missing API token cookie", 403);

  try {
    await verifyRouteGate({
      atk,
      ip,
      searchParams: request.nextUrl.searchParams,
    });
  } catch (error) {
    throw new AuthError(
      error instanceof Error ? error.message : "Invalid route gate",
      403
    );
  }

  const now = Date.now();
  if (Math.abs(now - envelope.timestampMs) > MAX_CLOCK_SKEW_MS) {
    throw new AuthError("Request timestamp out of range", 400);
  }
  if (!envelope.nonce || envelope.nonce.length < 16) {
    throw new AuthError("Invalid nonce", 400);
  }

  const payloadHash = await sha256Hex(envelope.payload);
  const canonical = buildCanonical({
    method,
    path,
    query: envelope.query,
    timestampMs: envelope.timestampMs,
    nonce: envelope.nonce,
    challengeId: envelope.challengeId || "",
    payloadHashHex: payloadHash,
    powNonce: envelope.powNonce || 0,
  });
  const expectedSig = await signCanonical(atk, canonical);
  if (!timingSafeEqual(expectedSig, envelope.signature)) {
    throw new AuthError("Invalid request signature", 403);
  }

  // Reads: signed with session ATK only (no one-time challenge / PoW).
  if (method === "GET" || method === "HEAD") {
    await enforceApiReadRateLimit({ ip });
    return { ip, atk, bootstrap: false };
  }

  const session = await getSession();
  await enforceApiMutateRateLimit({
    userId: session?.user?.id ?? null,
    ip,
  });

  const secSealed = readCookie(cookieHeader, SEC_COOKIE);
  const sec = await openSecCookie(secSealed);

  try {
    await consumeChallenge({
      challengeId: envelope.challengeId,
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

  if (!(await verifyPow(envelope.challengeId, envelope.powNonce))) {
    throw new AuthError("Proof-of-work failed", 403);
  }

  return { ip, atk, bootstrap: false };
}

/** Max Protobuf envelope size (compressed images ≤1MB; leave headroom). */
const MAX_TUNNEL_BODY_BYTES = 1_500_000;

/** Single app ingress: POST Protobuf request → Protobuf response. */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes(PROTOBUF_CONTENT_TYPE)) {
      return await protobufJsonError("Protobuf body required", 415);
    }

    // Reject oversized bodies before buffering (Content-Length when present).
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_TUNNEL_BODY_BYTES) {
      return await protobufJsonError("Request body too large", 413);
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_TUNNEL_BODY_BYTES) {
      return await protobufJsonError("Invalid request body", 400);
    }

    const cookieHeader = request.headers.get("cookie");
    const atkCookie = readCookie(cookieHeader, ATK_COOKIE);

    let envelope;
    try {
      // Bootstrap challenge has route_id and needs no ATK; sealed routes need ATK.
      envelope = await decodeInternalApiRequest(bytes, atkCookie);
    } catch {
      return await protobufJsonError("Malformed Protobuf envelope", 400);
    }

    const method = envelope.method.toUpperCase();
    if (!method || !envelope.path) {
      return await protobufJsonError("Invalid envelope", 400);
    }

    const { ip, atk } = await verifyEnvelope(request, envelope);

    let json: unknown = null;
    const isBinary =
      Boolean(envelope.contentType) &&
      !envelope.contentType.includes("json") &&
      !envelope.contentType.includes("x-www-form-urlencoded") &&
      envelope.payload.byteLength > 0;
    if (!isBinary && envelope.payload.byteLength > 0) {
      try {
        const text = new TextDecoder().decode(envelope.payload);
        if (envelope.contentType.includes("x-www-form-urlencoded")) {
          json = Object.fromEntries(new URLSearchParams(text));
        } else {
          json = text ? JSON.parse(text) : null;
        }
      } catch {
        return await protobufJsonError("Invalid JSON payload", 400);
      }
    }

    const inner = await runWithTunnelContext(
      {
        verified: true,
        json,
        raw: envelope.payload,
        ip,
        contentType: envelope.contentType || null,
        filename: envelope.filename || null,
      },
      () =>
        dispatchInternalApi({
          request,
          method,
          path: envelope.path,
          query: envelope.query,
          body: envelope.payload,
          contentType: envelope.contentType || null,
        })
    );

    // Seal with request ATK when present. Challenge responses seal with the
    // newly minted ATK from Set-Cookie (handled inside wrapAsProtobufResponse).
    // Do NOT rotate the query gate per request — concurrent calls share one gate.
    return wrapAsProtobufResponse(inner, { sealAtk: atk });
  } catch (error) {
    if (error instanceof AuthError) {
      return await protobufAuthError(error, { sealAtk: readCookie(request.headers.get("cookie"), ATK_COOKIE) });
    }
    console.error("POST /i/api failed", error);
    return await protobufJsonError("Request failed", 500, {
      sealAtk: readCookie(request.headers.get("cookie"), ATK_COOKIE),
    });
  }
}

/** Non-POST looks like a normal missing page — never advertise this endpoint. */
export async function GET() {
  return fakeNotFoundResponse();
}

export async function HEAD() {
  return fakeNotFoundResponse();
}

export async function PUT() {
  return fakeNotFoundResponse();
}

export async function PATCH() {
  return fakeNotFoundResponse();
}

export async function DELETE() {
  return fakeNotFoundResponse();
}

export async function OPTIONS() {
  return fakeNotFoundResponse();
}
