/**
 * Opaque public IDs (YouTube-style): short, URL-safe, non-sequential.
 * Alphabet is base64url; length 11 ≈ 66 bits of entropy.
 */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const PUBLIC_ID_LENGTH = 11;

export function createPublicId(length = PUBLIC_ID_LENGTH): string {
  if (length < 8 || length > 32) {
    throw new Error("Public id length must be between 8 and 32");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    // 256 % 64 === 0 → uniform mapping, no modulo bias
    id += ALPHABET[bytes[i]! & 63];
  }
  return id;
}

export function isPublicId(value: string, length = PUBLIC_ID_LENGTH): boolean {
  if (value.length !== length) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}
