/** Shared by browser signer and server verifier (no Node/CF imports). */

export const ATK_COOKIE = "red_atk";
export const SEC_COOKIE = "red_sec";
/** Readable: current random /i/api query param name. */
export const GATE_NAME_COOKIE = "red_qn";
/** Readable: current random /i/api query param value. */
export const GATE_VALUE_COOKIE = "red_qv";
export const CHALLENGE_TTL_MS = 90_000;
export const POW_DIFFICULTY = 12;
export const MAX_CLOCK_SKEW_MS = 60_000;

export function buildCanonical(input: {
  method: string;
  path: string;
  query?: string;
  timestampMs: number;
  nonce: string;
  challengeId: string;
  payloadHashHex: string;
  powNonce: number;
}): string {
  return [
    "v2",
    input.method.toUpperCase(),
    input.path,
    input.query ?? "",
    String(input.timestampMs),
    input.nonce,
    input.challengeId,
    input.payloadHashHex,
    String(input.powNonce),
  ].join("\n");
}

export async function sha256HexBrowser(
  data: BufferSource | string
): Promise<string> {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(
          data instanceof ArrayBuffer ? data : (data.buffer as ArrayBuffer),
          data instanceof ArrayBuffer ? 0 : (data as ArrayBufferView).byteOffset,
          data instanceof ArrayBuffer
            ? data.byteLength
            : (data as ArrayBufferView).byteLength
        );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Browser(
  keyBytes: BufferSource,
  message: string
): Promise<Uint8Array> {
  const keyBuf =
    keyBytes instanceof ArrayBuffer
      ? new Uint8Array(keyBytes)
      : new Uint8Array(
          (keyBytes as ArrayBufferView).buffer as ArrayBuffer,
          (keyBytes as ArrayBufferView).byteOffset,
          (keyBytes as ArrayBufferView).byteLength
        );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(sig);
}

export function randomTokenBrowser(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPowBits(
  challengeId: string,
  powNonce: number,
  difficulty: number,
  sha: (s: string) => Promise<string>
): Promise<boolean> {
  const hex = await sha(`${challengeId}:${powNonce}`);
  const neededNibbles = Math.floor(difficulty / 4);
  const rem = difficulty % 4;
  if (!hex.startsWith("0".repeat(neededNibbles))) return false;
  if (rem === 0) return true;
  const next = Number.parseInt(hex[neededNibbles] ?? "f", 16);
  const mask = 0xf << (4 - rem);
  return (next & mask) === 0;
}
