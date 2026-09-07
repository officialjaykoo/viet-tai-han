/**
 * Opaque public IDs (YouTube-style): short, URL-safe, non-sequential.
 * Alphabet is base64url; length 11 ≈ 66 bits of entropy.
 */
const PUBLIC_ID_ALPHABET =
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
    id += PUBLIC_ID_ALPHABET[bytes[i]! & 63];
  }
  return id;
}

export function isPublicId(value: string, length = PUBLIC_ID_LENGTH): boolean {
  if (value.length !== length) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_REJECTION_LIMIT = 248;

export const USER_ID_LENGTH = 16;

/** Uniform cryptographic Base62 IDs for Better Auth and identity migrations. */
export function generateBase62Id(length = 32): string {
  if (!Number.isInteger(length) || length < 1 || length > 256) {
    throw new Error("Base62 id length must be between 1 and 256");
  }

  let id = "";
  while (id.length < length) {
    const bytes = new Uint8Array(Math.max(16, length - id.length));
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= BASE62_REJECTION_LIMIT) continue;
      id += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
      if (id.length === length) break;
    }
  }
  return id;
}

export function generateUserId(): string {
  return generateBase62Id(USER_ID_LENGTH);
}

export function isBase62Id(value: string, length: number): boolean {
  return value.length === length && /^[0-9A-Za-z]+$/.test(value);
}
