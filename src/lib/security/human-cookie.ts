import { getEnv } from "@/lib/db";
import {
  bytesToBase64Url,
  hmacSha256,
  timingSafeEqual,
  base64UrlToBytes,
} from "@/lib/security/crypto";

export const HUMAN_COOKIE = "red_human";
export const HUMAN_TTL_MS = 3 * 60_000;

async function humanSecret(): Promise<Uint8Array> {
  const env = await getEnv();
  const secret =
    env.BETTER_AUTH_SECRET || "dev-secret-must-be-at-least-32-chars!!";
  return new TextEncoder().encode(`red-human-v1:${secret}`);
}

export async function sealHumanToken(payload: string): Promise<string> {
  const mac = await hmacSha256(await humanSecret(), payload);
  return `${payload}.${bytesToBase64Url(mac)}`;
}

export async function openHumanToken(
  value: string | null
): Promise<string | null> {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = await hmacSha256(await humanSecret(), payload);
  try {
    if (!timingSafeEqual(expected, base64UrlToBytes(mac))) return null;
  } catch {
    return null;
  }
  const [expStr] = payload.split(":");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return payload;
}
