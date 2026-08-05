import { getEnv } from "@/lib/db";
import {
  ATK_COOKIE,
  SEC_COOKIE,
  CHALLENGE_TTL_MS,
  POW_DIFFICULTY,
  MAX_CLOCK_SKEW_MS,
  buildCanonical,
} from "@/lib/security/shared";
import {
  bytesToBase64Url,
  hmacSha256,
  randomToken,
  sha256Hex,
  timingSafeEqual,
  base64UrlToBytes,
} from "@/lib/security/crypto";

export {
  ATK_COOKIE,
  SEC_COOKIE,
  CHALLENGE_TTL_MS,
  POW_DIFFICULTY,
  MAX_CLOCK_SKEW_MS,
  buildCanonical,
};

export type RouteGate = {
  name: string;
  value: string;
  expiresAt: number;
};

export type IssuedChallenge = {
  challengeId: string;
  expiresAt: number;
  powDifficulty: number;
  /** Ephemeral signing key material for the browser (also mirrored in red_atk). */
  atk: string;
  /** HttpOnly binder token (sealed into red_sec). */
  sec: string;
  /** Random /i/api query param name + value (server-minted). */
  gate: RouteGate;
};

type ChallengeRecord = {
  atk: string;
  sec: string;
  expiresAt: number;
  used: boolean;
  ipHash: string;
};

const memoryChallenges = new Map<string, ChallengeRecord>();

async function signingSecret(): Promise<Uint8Array> {
  const env = await getEnv();
  const secret =
    env.BETTER_AUTH_SECRET || "dev-secret-must-be-at-least-32-chars!!";
  const enc = new TextEncoder();
  return enc.encode(`red-api-guard-v1:${secret}`);
}

async function kv() {
  try {
    const env = await getEnv();
    if ("CACHE" in env && env.CACHE) return env.CACHE;
  } catch {
    // ignore
  }
  return null;
}

function challengeKey(id: string) {
  return `sec:chal:${id}`;
}

export async function hashIp(ip: string): Promise<string> {
  return sha256Hex(`ip:${ip}`);
}

export async function mintChallenge(ip: string): Promise<IssuedChallenge> {
  const challengeId = randomToken(16);
  const atk = randomToken(32);
  const sec = randomToken(32);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const ipHash = await hashIp(ip);
  const record: ChallengeRecord = { atk, sec, expiresAt, used: false, ipHash };

  const store = await kv();
  if (store) {
    await store.put(challengeKey(challengeId), JSON.stringify(record), {
      expirationTtl: Math.ceil(CHALLENGE_TTL_MS / 1000) + 30,
    });
  } else {
    memoryChallenges.set(challengeId, record);
  }

  const gate = await mintRouteGate({ atk, ip });
  return {
    challengeId,
    expiresAt,
    powDifficulty: POW_DIFFICULTY,
    atk,
    sec,
    gate,
  };
}

async function loadChallenge(
  challengeId: string
): Promise<ChallengeRecord | null> {
  const store = await kv();
  if (store) {
    const raw = await store.get(challengeKey(challengeId));
    if (!raw) return null;
    return JSON.parse(raw) as ChallengeRecord;
  }
  return memoryChallenges.get(challengeId) ?? null;
}

async function saveChallenge(challengeId: string, record: ChallengeRecord) {
  const store = await kv();
  if (store) {
    const ttl = Math.max(5, Math.ceil((record.expiresAt - Date.now()) / 1000));
    await store.put(challengeKey(challengeId), JSON.stringify(record), {
      expirationTtl: ttl + 30,
    });
    return;
  }
  memoryChallenges.set(challengeId, record);
}

export async function consumeChallenge(input: {
  challengeId: string;
  atkCookie: string | null;
  secCookie: string | null;
  ip: string;
}): Promise<{ atk: string; sec: string }> {
  const record = await loadChallenge(input.challengeId);
  if (!record) throw new Error("Invalid or expired challenge");
  if (record.used) throw new Error("Challenge already used");
  if (record.expiresAt < Date.now()) throw new Error("Challenge expired");

  const ipHash = await hashIp(input.ip);
  if (record.ipHash !== ipHash) throw new Error("Challenge IP mismatch");
  if (!input.atkCookie || input.atkCookie !== record.atk) {
    throw new Error("Missing API token cookie");
  }
  if (!input.secCookie || input.secCookie !== record.sec) {
    throw new Error("Missing security cookie");
  }

  record.used = true;
  await saveChallenge(input.challengeId, record);
  return { atk: record.atk, sec: record.sec };
}

/** Canonical string bound to method, path, payload, time, and challenge. */

export async function signCanonical(
  atk: string,
  canonical: string
): Promise<Uint8Array> {
  const keyMaterial = new TextEncoder().encode(atk);
  return hmacSha256(keyMaterial, canonical);
}

export async function verifyPow(
  challengeId: string,
  powNonce: number,
  difficulty = POW_DIFFICULTY
): Promise<boolean> {
  const { verifyPowBits } = await import("@/lib/security/shared");
  return verifyPowBits(challengeId, powNonce, difficulty, sha256Hex);
}

export async function sealSecCookie(sec: string): Promise<string> {
  const mac = await hmacSha256(await signingSecret(), sec);
  return `${sec}.${bytesToBase64Url(mac)}`;
}

export async function openSecCookie(value: string | null): Promise<string | null> {
  if (!value) return null;
  const [sec, mac] = value.split(".");
  if (!sec || !mac) return null;
  const expected = await hmacSha256(await signingSecret(), sec);
  try {
    if (!timingSafeEqual(expected, base64UrlToBytes(mac))) return null;
  } catch {
    return null;
  }
  return sec;
}

export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

/** Random query-param gate for /i/api (name + value both server-minted). */
type GateRecord = {
  name: string;
  value: string;
  expiresAt: number;
  ipHash: string;
};

const memoryGates = new Map<string, GateRecord>();

function gateStoreKey(atk: string) {
  return `sec:gate:${atk.slice(0, 48)}`;
}

/** Query param names must look like random identifiers, not fixed API tokens. */
function randomQueryParamName(): string {
  // Letter prefix + random hex so the name is a valid opaque query key.
  const hex = randomToken(5);
  const prefix = String.fromCharCode(97 + (hex.charCodeAt(0)! % 26));
  return `${prefix}${hex}`;
}

export async function mintRouteGate(input: {
  atk: string;
  ip: string;
}): Promise<RouteGate> {
  const name = randomQueryParamName();
  const value = randomToken(18);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const ipHash = await hashIp(input.ip);
  const record: GateRecord = { name, value, expiresAt, ipHash };

  const store = await kv();
  if (store) {
    await store.put(gateStoreKey(input.atk), JSON.stringify(record), {
      expirationTtl: Math.ceil(CHALLENGE_TTL_MS / 1000) + 30,
    });
  } else {
    memoryGates.set(gateStoreKey(input.atk), record);
  }

  return { name, value, expiresAt };
}

async function loadRouteGate(atk: string): Promise<GateRecord | null> {
  const key = gateStoreKey(atk);
  const store = await kv();
  if (store) {
    const raw = await store.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as GateRecord;
  }
  return memoryGates.get(key) ?? null;
}

/**
 * Validate /i/api?{randomName}={randomValue} against the server-issued gate
 * bound to the current ATK.
 */
export async function verifyRouteGate(input: {
  atk: string;
  ip: string;
  searchParams: URLSearchParams;
}): Promise<void> {
  const record = await loadRouteGate(input.atk);
  if (!record) throw new Error("Missing route gate");
  if (record.expiresAt < Date.now()) throw new Error("Route gate expired");

  const ipHash = await hashIp(input.ip);
  if (record.ipHash !== ipHash) throw new Error("Route gate IP mismatch");

  const provided = input.searchParams.get(record.name);
  if (!provided || provided !== record.value) {
    throw new Error("Invalid route gate");
  }

  // Reject unexpected extra verification-looking params? Keep loose — only check ours.
}

/** Rotate gate after a successful request; returns the new pair for the client. */
export async function rotateRouteGate(input: {
  atk: string;
  ip: string;
}): Promise<RouteGate> {
  return mintRouteGate(input);
}
