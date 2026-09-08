/**
 * Browser API client — every app call is POST /i/api with Protobuf
 * request + response envelopes.
 */

import {
  ATK_COOKIE,
  GATE_NAME_COOKIE,
  GATE_VALUE_COOKIE,
  POW_DIFFICULTY,
  buildCanonical,
  hmacSha256Browser,
  randomTokenBrowser,
  sha256HexBrowser,
} from "@/lib/security/shared";
import { isAtkOnlyMutation } from "@/lib/security/tunnel-policy";
import {
  encodeInternalApiRequest,
  resolveInternalApiResponse,
  PROTOBUF_CONTENT_TYPE,
} from "@/lib/security/protobuf";

export const INTERNAL_API_PATH = "/i/api";

type ChallengeResponse = {
  challengeId: string;
  expiresAt: number;
  powDifficulty: number;
  /** Server-random /i/api query param name. */
  n?: string;
  /** Server-random /i/api query param value. */
  v?: string;
};
let atkBootstrapPromise: Promise<string> | null = null;

/**
 * Reads may run together, but a challenge-backed write must wait for them and
 * hold the ATK stable until its response is decoded.
 */
const resolvedApiWrite = Promise.resolve();
let signedWriteTail = resolvedApiWrite;
let activeSignedReads = 0;
let readersDrained: Promise<void> | null = null;
let resolveReadersDrained: (() => void) | null = null;

async function withSignedRead<T>(operation: () => Promise<T>): Promise<T> {
  const pendingWrites = signedWriteTail;
  if (pendingWrites !== resolvedApiWrite) {
    await pendingWrites;
  }
  activeSignedReads += 1;
  try {
    return await operation();
  } finally {
    activeSignedReads -= 1;
    if (activeSignedReads === 0) {
      resolveReadersDrained?.();
      resolveReadersDrained = null;
      readersDrained = null;
    }
  }
}

async function withSignedWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previousWrite = signedWriteTail;
  let releaseWrite!: () => void;
  const currentWrite = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  signedWriteTail = currentWrite;

  await previousWrite;
  if (activeSignedReads > 0) {
    readersDrained ??= new Promise<void>((resolve) => {
      resolveReadersDrained = resolve;
    });
    await readersDrained;
  }

  try {
    return await operation();
  } finally {
    releaseWrite();
    if (signedWriteTail === currentWrite) {
      signedWriteTail = resolvedApiWrite;
    }
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Build /i/api?{serverRandomName}={serverRandomValue} from gate cookies. */
function tunnelUrl(): string {
  const name = readCookie(GATE_NAME_COOKIE);
  const value = readCookie(GATE_VALUE_COOKIE);
  if (!name || !value) return INTERNAL_API_PATH;
  return `${INTERNAL_API_PATH}?${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
}

async function solvePow(
  challengeId: string,
  difficulty: number
): Promise<number> {
  const neededNibbles = Math.floor(difficulty / 4);
  const rem = difficulty % 4;
  const prefix = "0".repeat(neededNibbles);
  const enc = new TextEncoder();

  for (let nonce = 0; nonce < 5_000_000; nonce++) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      enc.encode(`${challengeId}:${nonce}`)
    );
    const hex = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (!hex.startsWith(prefix)) continue;
    if (rem === 0) return nonce;
    const next = Number.parseInt(hex[neededNibbles] ?? "f", 16);
    const mask = 0xf << (4 - rem);
    if ((next & mask) === 0) return nonce;
  }
  throw new Error("Could not solve proof-of-work");
}

/** Decode tunnel Protobuf into a Response the rest of the app can use. */
async function unwrapTunnelResponse(
  http: Response,
  responseAtk?: string | null
): Promise<Response> {
  const contentType = http.headers.get("content-type") ?? "";
  if (!contentType.includes(PROTOBUF_CONTENT_TYPE)) {
    // Tunnel must always speak Protobuf; treat anything else as a hard failure.
    return new Response(
      JSON.stringify({ error: "Expected Protobuf tunnel response" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const bytes = new Uint8Array(await http.arrayBuffer());
  let frame;
  try {
    // Use the ATK that signed this request; the browser cookie may rotate
    // while another request is being prepared.
    frame = await resolveInternalApiResponse(
      bytes,
      responseAtk ?? readCookie(ATK_COOKIE)
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed Protobuf tunnel response" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers();
  if (frame.contentType) {
    headers.set("Content-Type", frame.contentType);
  }

  return new Response(new Uint8Array(frame.body), {
    status: frame.status || 500,
    headers,
  });
}

async function postEnvelope(
  envelope: Uint8Array,
  responseAtk?: string | null
): Promise<Response> {
  const http = await fetch(tunnelUrl(), {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": PROTOBUF_CONTENT_TYPE,
      Accept: PROTOBUF_CONTENT_TYPE,
    },
    body: envelope as unknown as BodyInit,
  });
  return unwrapTunnelResponse(http, responseAtk);
}

/** Unsigned bootstrap — only used to mint the challenge cookies. */
async function fetchChallenge(): Promise<ChallengeResponse> {
  const envelope = await encodeInternalApiRequest(
    {
      method: "GET",
      path: "/api/security/challenge",
      query: "",
      timestampMs: Date.now(),
      nonce: "",
      payload: new Uint8Array(),
      signature: new Uint8Array(),
      challengeId: "",
      powNonce: 0,
      contentType: "",
      filename: "",
    },
    null
  );
  const res = await postEnvelope(envelope);
  if (!res.ok) {
    throw new Error("Could not obtain API challenge");
  }
  return (await res.json()) as ChallengeResponse;
}

async function ensureAtk(): Promise<string> {
  const current = readCookie(ATK_COOKIE);
  if (current) return current;

  if (!atkBootstrapPromise) {
    atkBootstrapPromise = (async () => {
      const existing = readCookie(ATK_COOKIE);
      if (existing) return existing;
      await fetchChallenge();
      const next = readCookie(ATK_COOKIE);
      if (!next) throw new Error("Missing API token cookie");
      return next;
    })().finally(() => {
      atkBootstrapPromise = null;
    });
  }

  return atkBootstrapPromise;
}
/** Signed ATK-only requests (reads and logout; no challenge / PoW). */
async function signAtkAndSend(input: {
  method: string;
  path: string;
  query: string;
  payload?: Uint8Array;
  contentType?: string;
  filename?: string;
}): Promise<Response> {
  return withSignedRead(async () => {
    const atk = await ensureAtk();
    const payload = input.payload ?? new Uint8Array();
    const payloadHash = await sha256HexBrowser(payload as BufferSource);
    const timestampMs = Date.now();
    const nonce = randomTokenBrowser(16);
    const canonical = buildCanonical({
      method: input.method,
      path: input.path,
      query: input.query,
      timestampMs,
      nonce,
      challengeId: "",
      payloadHashHex: payloadHash,
      powNonce: 0,
    });
    const signature = await hmacSha256Browser(
      new TextEncoder().encode(atk),
      canonical
    );
    const envelope = await encodeInternalApiRequest(
      {
        method: input.method,
        path: input.path,
        query: input.query,
        timestampMs,
        nonce,
        payload,
        signature,
        challengeId: "",
        powNonce: 0,
        contentType: input.contentType ?? "",
        filename: input.filename ?? "",
      },
      atk
    );
    return postEnvelope(envelope, atk);
  });
}

async function signAndSend(input: {
  method: string;
  path: string;
  query: string;
  payload: Uint8Array;
  contentType?: string;
  filename?: string;
}): Promise<Response> {
  return withSignedWrite(async () => {
    const challenge = await fetchChallenge();
    const atk = readCookie(ATK_COOKIE);
    if (!atk) throw new Error("Missing API token cookie");

    const payloadHash = await sha256HexBrowser(input.payload as BufferSource);
    const timestampMs = Date.now();
    const nonce = randomTokenBrowser(16);
    const powDifficulty = challenge.powDifficulty || POW_DIFFICULTY;
    const powNonce = await solvePow(challenge.challengeId, powDifficulty);
    const canonical = buildCanonical({
      method: input.method,
      path: input.path,
      query: input.query,
      timestampMs,
      nonce,
      challengeId: challenge.challengeId,
      payloadHashHex: payloadHash,
      powNonce,
    });
    const signature = await hmacSha256Browser(
      new TextEncoder().encode(atk),
      canonical
    );

    const envelope = await encodeInternalApiRequest(
      {
        method: input.method,
        path: input.path,
        query: input.query,
        timestampMs,
        nonce,
        payload: input.payload,
        signature,
        challengeId: challenge.challengeId,
        powNonce,
        contentType: input.contentType ?? "",
        filename: input.filename ?? "",
      },
      atk
    );

    return postEnvelope(envelope, atk);
  });
}

/**
 * All app API traffic goes through POST /i/api (Protobuf both ways).
 * `input` is the logical URL (pathname + search), e.g. `/api/posts?sort=hot`.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(input, window.location.origin);
  const path = url.pathname;
  const query = url.search.startsWith("?")
    ? url.search.slice(1)
    : url.search;

  if (typeof FormData !== "undefined" && init.body instanceof FormData) {
    const file = init.body.get("file");
    if (!(file instanceof File)) {
      throw new Error("file is required");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return signAndSend({
      method,
      path,
      query,
      payload: bytes,
      contentType: file.type || "application/octet-stream",
      filename: file.name || "upload.bin",
    });
  }

  let payload = new Uint8Array();
  let contentType = "";
  if (typeof init.body === "string") {
    payload = new TextEncoder().encode(init.body);
    contentType =
      (init.headers as Record<string, string> | undefined)?.["content-type"] ??
      (init.headers as Record<string, string> | undefined)?.["Content-Type"] ??
      "application/json";
  } else if (init.body instanceof Uint8Array) {
    payload = new Uint8Array(init.body);
    contentType = "application/octet-stream";
  } else if (init.body instanceof ArrayBuffer) {
    payload = new Uint8Array(init.body);
    contentType = "application/octet-stream";
  } else if (typeof Blob !== "undefined" && init.body instanceof Blob) {
    payload = new Uint8Array(await init.body.arrayBuffer());
    contentType = init.body.type || "application/octet-stream";
  } else if (init.body instanceof URLSearchParams) {
    payload = new TextEncoder().encode(init.body.toString());
    contentType = "application/x-www-form-urlencoded";
  } else if (init.body != null) {
    payload = new TextEncoder().encode(JSON.stringify(init.body));
    contentType = "application/json";
  }

  if (path === "/api/security/challenge" && method === "GET") {
    return withSignedWrite(async () => {
      const data = await fetchChallenge();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  if (isAtkOnlyMutation(method, path)) {
    return signAtkAndSend({
      method,
      path,
      query,
      payload,
      contentType,
    });
  }

  if (method === "GET" || method === "HEAD") {
    return signAtkAndSend({ method, path, query });
  }

  return signAndSend({
    method,
    path,
    query,
    payload,
    contentType,
  });
}

export async function apiJson(
  input: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<Response> {
  const { body, ...rest } = init;
  return apiFetch(input, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...((rest.headers as Record<string, string>) ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
