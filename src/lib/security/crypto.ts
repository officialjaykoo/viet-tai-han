const textEncoder = new TextEncoder();

/** Copy into a plain ArrayBuffer so WebCrypto typings accept it. */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

function asBytes(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

export async function sha256Bytes(
  data: Uint8Array | ArrayBuffer
): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(asBytes(data)));
  return new Uint8Array(digest);
}

export async function sha256Hex(
  data: Uint8Array | ArrayBuffer | string
): Promise<string> {
  const bytes =
    typeof data === "string" ? textEncoder.encode(data) : asBytes(data);
  const digest = await sha256Bytes(bytes);
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(
  keyBytes: Uint8Array | ArrayBuffer,
  message: Uint8Array | ArrayBuffer | string
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(asBytes(keyBytes)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data =
    typeof message === "string"
      ? textEncoder.encode(message)
      : asBytes(message);
  const sig = await crypto.subtle.sign("HMAC", key, toArrayBuffer(data));
  return new Uint8Array(sig);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
