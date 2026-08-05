/**
 * Minimal Protobuf wire codec for InternalApiRequest / InternalApiResponse (proto3).
 * Routing fields use method codes + ATK-sealed path/query (no plaintext routes).
 */

import {
  ROUTE_ID_CHALLENGE,
  codeToMethod,
  isChallengeBootstrap,
  methodToCode,
  openPayload,
  openRoute,
  sealPayload,
  sealRoute,
} from "@/lib/security/route-seal";

export type InternalApiRequest = {
  method: string;
  path: string;
  /** Raw query string without leading `?` (may be empty). */
  query: string;
  timestampMs: number;
  nonce: string;
  payload: Uint8Array;
  signature: Uint8Array;
  challengeId: string;
  powNonce: number;
  /** Optional MIME for binary payloads (e.g. image/jpeg uploads). */
  contentType: string;
  filename: string;
};

/** Logical handler result, carried inside the /i/api Protobuf response. */
export type InternalApiResponse = {
  /** HTTP status from the logical handler (200, 401, …). */
  status: number;
  contentType: string;
  body: Uint8Array;
  /** Next random /i/api query param name (server-minted). */
  gateName: string;
  /** Next random /i/api query param value (server-minted). */
  gateValue: string;
  /**
   * When set, contentType+body are ATK-sealed and must not be read from
   * plaintext fields (those stay empty on the wire).
   */
  sealedPayload: Uint8Array;
};

type WireRequest = {
  methodCode: number;
  routeBlob: Uint8Array;
  routeId: number;
  timestampMs: number;
  nonce: string;
  payload: Uint8Array;
  signature: Uint8Array;
  challengeId: string;
  powNonce: number;
  contentType: string;
  filename: string;
};

function encodeVarint(value: number): number[] {
  let n = value >>> 0;
  const out: number[] = [];
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return out;
}

function encodeVarintBig(value: bigint): number[] {
  let n = value;
  const out: number[] = [];
  const mask = BigInt(0x7f);
  const cont = BigInt(0x80);
  while (n >= cont) {
    out.push(Number(n & mask) | 0x80);
    n >>= BigInt(7);
  }
  out.push(Number(n));
  return out;
}

function writeTag(field: number, wire: number): number[] {
  return encodeVarint((field << 3) | wire);
}

function writeString(field: number, value: string): number[] {
  if (!value) return [];
  const bytes = new TextEncoder().encode(value);
  return [...writeTag(field, 2), ...encodeVarint(bytes.length), ...bytes];
}

function writeBytes(field: number, value: Uint8Array): number[] {
  if (value.byteLength === 0) return [];
  return [...writeTag(field, 2), ...encodeVarint(value.length), ...value];
}

function writeInt64(field: number, value: number): number[] {
  return [...writeTag(field, 0), ...encodeVarintBig(BigInt(value))];
}

function writeUint32(field: number, value: number): number[] {
  if (!value) return [];
  return [...writeTag(field, 0), ...encodeVarint(value >>> 0)];
}

function writeUint32Required(field: number, value: number): number[] {
  return [...writeTag(field, 0), ...encodeVarint(value >>> 0)];
}

function encodeWireRequest(msg: WireRequest): Uint8Array {
  const parts = [
    ...writeUint32Required(1, msg.methodCode),
    ...writeBytes(2, msg.routeBlob),
    ...writeUint32(3, msg.routeId),
    ...writeInt64(4, msg.timestampMs),
    ...writeString(5, msg.nonce),
    ...writeBytes(6, msg.payload),
    ...writeBytes(7, msg.signature),
    ...writeString(8, msg.challengeId),
    ...writeUint32(9, msg.powNonce),
    ...writeString(10, msg.contentType),
    ...writeString(11, msg.filename),
  ];
  return new Uint8Array(parts);
}

/**
 * Encode a logical request. Pass `atk` to seal path/query; omit for challenge bootstrap.
 */
export async function encodeInternalApiRequest(
  msg: InternalApiRequest,
  atk?: string | null
): Promise<Uint8Array> {
  const methodCode = methodToCode(msg.method);
  const isChallenge =
    msg.method.toUpperCase() === "GET" &&
    msg.path === "/api/security/challenge";

  let routeBlob = new Uint8Array();
  let routeId = 0;
  if (isChallenge && !atk) {
    routeId = ROUTE_ID_CHALLENGE;
  } else {
    if (!atk) throw new Error("ATK required to seal route");
    routeBlob = new Uint8Array(await sealRoute(atk, msg.path, msg.query));
  }

  return encodeWireRequest({
    methodCode,
    routeBlob,
    routeId,
    timestampMs: msg.timestampMs,
    nonce: msg.nonce,
    payload: msg.payload,
    signature: msg.signature,
    challengeId: msg.challengeId,
    powNonce: msg.powNonce,
    contentType: msg.contentType,
    filename: msg.filename,
  });
}

/** @deprecated Alias — prefer encodeInternalApiRequest. */
export const encodeSignedApiRequest = (
  msg: Omit<InternalApiRequest, "query" | "contentType" | "filename"> & {
    query?: string;
    contentType?: string;
    filename?: string;
  },
  atk?: string | null
) =>
  encodeInternalApiRequest(
    {
      query: "",
      contentType: "",
      filename: "",
      ...msg,
    },
    atk
  );

/**
 * InternalApiResponse {
 *   uint32 status = 1;
 *   string content_type = 2;
 *   bytes body = 3;
 *   string gate_name = 4;
 *   string gate_value = 5;
 * }
 */
export function encodeInternalApiResponse(msg: InternalApiResponse): Uint8Array {
  const sealed = msg.sealedPayload.byteLength > 0;
  if (sealed) {
    return new Uint8Array([
      ...writeUint32Required(1, msg.status),
      ...writeBytes(6, msg.sealedPayload),
      ...writeString(4, msg.gateName),
      ...writeString(5, msg.gateValue),
    ]);
  }
  return new Uint8Array([
    ...writeUint32Required(1, msg.status),
    ...writeString(2, msg.contentType),
    ...writeBytes(3, msg.body),
    ...writeString(4, msg.gateName),
    ...writeString(5, msg.gateValue),
  ]);
}

/** Build a wire response; seals content-type+body when `atk` is provided. */
export async function buildInternalApiResponse(
  msg: Omit<InternalApiResponse, "sealedPayload">,
  atk?: string | null
): Promise<Uint8Array> {
  if (atk) {
    const sealedPayload = new Uint8Array(
      await sealPayload(atk, msg.contentType, msg.body)
    );
    return encodeInternalApiResponse({
      status: msg.status,
      contentType: "",
      body: new Uint8Array(),
      gateName: msg.gateName,
      gateValue: msg.gateValue,
      sealedPayload,
    });
  }
  return encodeInternalApiResponse({
    ...msg,
    sealedPayload: new Uint8Array(),
  });
}


function readVarint(
  buf: Uint8Array,
  offset: number
): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++]!;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
  return { value: result >>> 0, next: pos };
}

function readVarintBig(
  buf: Uint8Array,
  offset: number
): { value: bigint; next: number } {
  let result = BigInt(0);
  let shift = BigInt(0);
  let pos = offset;
  const mask = BigInt(0x7f);
  const cont = BigInt(0x80);
  while (pos < buf.length) {
    const byte = BigInt(buf[pos++]!);
    result |= (byte & mask) << shift;
    if ((byte & cont) === BigInt(0)) break;
    shift += BigInt(7);
    if (shift > BigInt(70)) throw new Error("varint too long");
  }
  return { value: result, next: pos };
}

function decodeWireRequest(buf: Uint8Array): WireRequest {
  const out: WireRequest = {
    methodCode: 0,
    routeBlob: new Uint8Array(),
    routeId: 0,
    timestampMs: 0,
    nonce: "",
    payload: new Uint8Array(),
    signature: new Uint8Array(),
    challengeId: "",
    powNonce: 0,
    contentType: "",
    filename: "",
  };

  let pos = 0;
  const text = new TextDecoder();
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const field = tag.value >>> 3;
    const wire = tag.value & 0x7;

    if (wire === 0) {
      const v = readVarintBig(buf, pos);
      pos = v.next;
      if (field === 1) out.methodCode = Number(v.value);
      else if (field === 3) out.routeId = Number(v.value);
      else if (field === 4) out.timestampMs = Number(v.value);
      else if (field === 9) out.powNonce = Number(v.value);
      continue;
    }

    if (wire === 2) {
      const len = readVarint(buf, pos);
      pos = len.next;
      const slice = buf.slice(pos, pos + len.value);
      pos += len.value;
      if (field === 2) out.routeBlob = slice;
      else if (field === 5) out.nonce = text.decode(slice);
      else if (field === 6) out.payload = slice;
      else if (field === 7) out.signature = slice;
      else if (field === 8) out.challengeId = text.decode(slice);
      else if (field === 10) out.contentType = text.decode(slice);
      else if (field === 11) out.filename = text.decode(slice);
      continue;
    }

    throw new Error(`unsupported protobuf wire type ${wire}`);
  }

  return out;
}

/**
 * Decode envelope and resolve sealed route using ATK (null for challenge bootstrap).
 */
export async function decodeInternalApiRequest(
  buf: Uint8Array,
  atk?: string | null
): Promise<InternalApiRequest> {
  const wire = decodeWireRequest(buf);
  const method = codeToMethod(wire.methodCode);

  let path = "";
  let query = "";
  if (isChallengeBootstrap(wire.routeId)) {
    path = "/api/security/challenge";
    query = "";
  } else {
    if (!atk) throw new Error("ATK required to open route");
    const opened = await openRoute(atk, wire.routeBlob);
    path = opened.path;
    query = opened.query;
  }

  return {
    method,
    path,
    query,
    timestampMs: wire.timestampMs,
    nonce: wire.nonce,
    payload: wire.payload,
    signature: wire.signature,
    challengeId: wire.challengeId,
    powNonce: wire.powNonce,
    contentType: wire.contentType,
    filename: wire.filename,
  };
}

export function decodeInternalApiResponse(buf: Uint8Array): InternalApiResponse {
  const out: InternalApiResponse = {
    status: 0,
    contentType: "",
    body: new Uint8Array(),
    gateName: "",
    gateValue: "",
    sealedPayload: new Uint8Array(),
  };

  let pos = 0;
  const text = new TextDecoder();
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const field = tag.value >>> 3;
    const wire = tag.value & 0x7;

    if (wire === 0) {
      const v = readVarintBig(buf, pos);
      pos = v.next;
      if (field === 1) out.status = Number(v.value);
      continue;
    }

    if (wire === 2) {
      const len = readVarint(buf, pos);
      pos = len.next;
      const slice = buf.slice(pos, pos + len.value);
      pos += len.value;
      if (field === 2) out.contentType = text.decode(slice);
      else if (field === 3) out.body = slice;
      else if (field === 4) out.gateName = text.decode(slice);
      else if (field === 5) out.gateValue = text.decode(slice);
      else if (field === 6) out.sealedPayload = slice;
      continue;
    }

    throw new Error(`unsupported protobuf wire type ${wire}`);
  }

  return out;
}

/** Resolve sealed or plaintext response fields. */
export async function resolveInternalApiResponse(
  buf: Uint8Array,
  atk?: string | null
): Promise<InternalApiResponse> {
  const frame = decodeInternalApiResponse(buf);
  if (frame.sealedPayload.byteLength > 0) {
    if (!atk) throw new Error("ATK required to open sealed payload");
    const opened = await openPayload(atk, frame.sealedPayload);
    return {
      ...frame,
      contentType: opened.contentType,
      body: opened.body,
    };
  }
  return frame;
}

/** @deprecated Alias — prefer decodeInternalApiRequest. */
export const decodeSignedApiRequest = decodeInternalApiRequest;

export type SignedApiRequest = InternalApiRequest;

export const PROTOBUF_CONTENT_TYPE = "application/x-protobuf";
