/**
 * Opaque routing for /i/api envelopes: method codes + ATK-sealed path/query.
 * Keeps plaintext method/path out of the Protobuf wire format.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const METHOD_CODES = {
  GET: 1,
  POST: 2,
  PATCH: 3,
  PUT: 4,
  DELETE: 5,
  HEAD: 6,
} as const;

export type MethodName = keyof typeof METHOD_CODES;

/** Bootstrap: GET /api/security/challenge (no ATK yet). */
export const ROUTE_ID_CHALLENGE = 1;

const METHOD_BY_CODE: Record<number, MethodName> = {
  1: "GET",
  2: "POST",
  3: "PATCH",
  4: "PUT",
  5: "DELETE",
  6: "HEAD",
};

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export function methodToCode(method: string): number {
  const key = method.toUpperCase() as MethodName;
  const code = METHOD_CODES[key];
  if (!code) throw new Error(`Unsupported method ${method}`);
  return code;
}

export function codeToMethod(code: number): string {
  const method = METHOD_BY_CODE[code];
  if (!method) throw new Error(`Unsupported method code ${code}`);
  return method;
}

async function deriveRouteAesKey(atk: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(textEncoder.encode(`red-route-v1:${atk}`))
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Seal path + query so they are not visible as UTF-8 in the envelope. */
export async function sealRoute(
  atk: string,
  path: string,
  query: string
): Promise<Uint8Array> {
  const key = await deriveRouteAesKey(atk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = textEncoder.encode(`${path}\n${query}`);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(plain)
    )
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return out;
}

export async function openRoute(
  atk: string,
  blob: Uint8Array
): Promise<{ path: string; query: string }> {
  if (blob.byteLength < 13) throw new Error("Invalid route blob");
  const iv = blob.slice(0, 12);
  const cipher = blob.slice(12);
  const key = await deriveRouteAesKey(atk);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipher)
    )
  );
  const text = textDecoder.decode(plain);
  const nl = text.indexOf("\n");
  if (nl < 0) throw new Error("Invalid route blob payload");
  return { path: text.slice(0, nl), query: text.slice(nl + 1) };
}

export function isChallengeBootstrap(routeId: number): boolean {
  return routeId === ROUTE_ID_CHALLENGE;
}

async function derivePayloadAesKey(atk: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(textEncoder.encode(`red-payload-v1:${atk}`))
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Seal response content-type + body (keeps JSON/media opaque on the wire). */
export async function sealPayload(
  atk: string,
  contentType: string,
  body: Uint8Array
): Promise<Uint8Array> {
  const key = await derivePayloadAesKey(atk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = textEncoder.encode(`${contentType}\n`);
  const plain = new Uint8Array(header.length + body.byteLength);
  plain.set(header, 0);
  plain.set(body, header.length);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(plain)
    )
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return out;
}

export async function openPayload(
  atk: string,
  blob: Uint8Array
): Promise<{ contentType: string; body: Uint8Array }> {
  if (blob.byteLength < 13) throw new Error("Invalid payload blob");
  const iv = blob.slice(0, 12);
  const cipher = blob.slice(12);
  const key = await derivePayloadAesKey(atk);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipher)
    )
  );
  const nl = plain.indexOf(0x0a);
  if (nl < 0) throw new Error("Invalid payload blob header");
  return {
    contentType: textDecoder.decode(plain.slice(0, nl)),
    body: plain.slice(nl + 1),
  };
}
