import { getDb, getEnv } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  hmacSha256,
} from "@/lib/security/crypto";
import { AuthError } from "@/lib/session";

const textEncoder = new TextEncoder();
const MAX_PAYLOAD_BYTES = 2048;
const MAX_FAILURES = 5;

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type PushConfigState = "configured" | "missing" | "invalid" | "unavailable";

type PushConfigInspection = {
  state: PushConfigState;
  config: PushConfig | null;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

export type PushPayload = {
  title: string;
  body?: string | null;
  href?: string | null;
  tag?: string | null;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function encodeText(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function decodeKey(value: string, expectedLength: number, name: string) {
  try {
    const bytes = base64UrlToBytes(value);
    if (bytes.byteLength !== expectedLength) {
      throw new Error(`${name} has an invalid length`);
    }
    return bytes;
  } catch {
    throw new AuthError(`Invalid push subscription ${name}`, 400);
  }
}

export function validatePushSubscription(value: unknown): PushSubscriptionInput {
  if (!value || typeof value !== "object") {
    throw new AuthError("Invalid push subscription", 400);
  }
  const input = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    userAgent?: unknown;
  };
  if (typeof input.endpoint !== "string" || input.endpoint.length > 2048) {
    throw new AuthError("Invalid push subscription endpoint", 400);
  }
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new AuthError("Invalid push subscription endpoint", 400);
  }
  if (endpoint.protocol !== "https:") {
    throw new AuthError("Invalid push subscription endpoint", 400);
  }
  if (
    !input.keys ||
    typeof input.keys.p256dh !== "string" ||
    typeof input.keys.auth !== "string"
  ) {
    throw new AuthError("Invalid push subscription keys", 400);
  }
  decodeKey(input.keys.p256dh, 65, "p256dh");
  decodeKey(input.keys.auth, 16, "auth");
  const userAgent =
    typeof input.userAgent === "string"
      ? input.userAgent.slice(0, 500)
      : null;
  return {
    endpoint: endpoint.toString(),
    keys: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
    userAgent,
  };
}

export function inspectPushConfigValues(input: {
  publicKey?: string | null;
  privateKey?: string | null;
  subject?: string | null;
}): { state: PushConfigState; publicKey: string | null } {
  const publicKey = input.publicKey?.trim();
  const privateKey = input.privateKey?.trim();
  const subject = input.subject?.trim();
  if (!publicKey || !privateKey || !subject) {
    return { state: "missing", publicKey: null };
  }

  try {
    const publicBytes = base64UrlToBytes(publicKey);
    const privateBytes = base64UrlToBytes(privateKey);
    if (publicBytes.byteLength !== 65 || publicBytes[0] !== 4) {
      throw new Error("Invalid VAPID public key");
    }
    if (privateBytes.byteLength !== 32) {
      throw new Error("Invalid VAPID private key");
    }
    const subjectUrl = new URL(subject);
    const validSubject =
      (subjectUrl.protocol === "https:" && Boolean(subjectUrl.hostname)) ||
      (subjectUrl.protocol === "mailto:" && Boolean(subjectUrl.pathname));
    if (!validSubject) throw new Error("Invalid VAPID subject");
  } catch {
    return { state: "invalid", publicKey: null };
  }

  return { state: "configured", publicKey };
}

async function inspectPushConfig(): Promise<PushConfigInspection> {
  let env: CloudflareEnv;
  try {
    env = (await getEnv()) as CloudflareEnv;
  } catch {
    return { state: "unavailable", config: null };
  }

  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  const values = inspectPushConfigValues({ publicKey, privateKey, subject });
  if (values.state !== "configured") {
    return { state: values.state, config: null };
  }

  return {
    state: "configured",
    config: { publicKey: publicKey!, privateKey: privateKey!, subject: subject! },
  };
}

export async function getPushConfigStatus(): Promise<{
  state: PushConfigState;
  available: boolean;
  publicKey: string | null;
}> {
  const inspection = await inspectPushConfig();
  return {
    state: inspection.state,
    available: inspection.state === "configured",
    publicKey: inspection.config?.publicKey ?? null,
  };
}

export async function getPushConfig(): Promise<PushConfig | null> {
  return (await inspectPushConfig()).config;
}

export async function getPushStatus(userId: string) {
  const db = await getDb();
  const configStatus = await getPushConfigStatus();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM push_subscriptions
       WHERE user_id = ? AND disabled_at IS NULL`
    )
    .bind(userId)
    .first<{ c: number }>();
  return {
    available: configStatus.available,
    configuration: configStatus.state,
    publicKey: configStatus.publicKey,
    subscribed: Number(row?.c ?? 0) > 0,
  };
}

export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput
) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO push_subscriptions (
         id, user_id, endpoint, p256dh, auth_key, user_agent,
         failure_count, disabled_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'))
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth_key = excluded.auth_key,
         user_agent = excluded.user_agent,
         failure_count = 0,
         disabled_at = NULL,
         updated_at = datetime('now')`
    )
    .bind(
      createPublicId(),
      userId,
      input.endpoint,
      input.keys.p256dh,
      input.keys.auth,
      input.userAgent ?? null
    )
    .run();
  return { ok: true as const };
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  const db = await getDb();
  const result = await db
    .prepare(
      `DELETE FROM push_subscriptions
       WHERE user_id = ? AND endpoint = ?`
    )
    .bind(userId, endpoint)
    .run();
  return { ok: true as const, deleted: (result.meta.changes ?? 0) > 0 };
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const blocks: Uint8Array[] = [];
  let previous = new Uint8Array(0);
  for (let counter = 1; counter <= Math.ceil(length / 32); counter++) {
    const next = await hmacSha256(
      prk,
      concatBytes(previous, info, new Uint8Array([counter]))
    );
    previous = new Uint8Array(next.byteLength);
    previous.set(next);
    blocks.push(previous);
  }
  const expanded = concatBytes(...blocks);
  const output = new Uint8Array(length);
  output.set(expanded.subarray(0, length));
  return output;
}

function derSignatureToJose(signature: Uint8Array): Uint8Array {
  if (signature.byteLength === 64) return signature;
  if (signature[0] !== 0x30) throw new Error("Invalid ECDSA signature");
  let offset = 1;
  let sequenceLength = signature[offset++]!;
  if (sequenceLength & 0x80) {
    const lengthBytes = sequenceLength & 0x7f;
    sequenceLength = 0;
    for (let i = 0; i < lengthBytes; i++) {
      sequenceLength = (sequenceLength << 8) | signature[offset++]!;
    }
  }
  if (offset + sequenceLength > signature.byteLength || signature[offset++] !== 2) {
    throw new Error("Invalid ECDSA signature");
  }
  const rLength = signature[offset++]!;
  const r = signature.slice(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 2) throw new Error("Invalid ECDSA signature");
  const sLength = signature[offset++]!;
  const s = signature.slice(offset, offset + sLength);
  if (r.byteLength === 0 || s.byteLength === 0) {
    throw new Error("Invalid ECDSA signature");
  }
  const output = new Uint8Array(64);
  output.set(r.slice(-32), 32 - Math.min(32, r.byteLength));
  output.set(s.slice(-32), 64 - Math.min(32, s.byteLength));
  return output;
}

async function createVapidToken(endpoint: string, config: PushConfig) {
  const publicBytes = base64UrlToBytes(config.publicKey);
  const privateBytes = base64UrlToBytes(config.privateKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: bytesToBase64Url(privateBytes),
      ext: true,
    } as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const header = bytesToBase64Url(encodeText('{"alg":"ES256","typ":"JWT"}'));
  const payload = bytesToBase64Url(
    encodeText(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: config.subject,
      })
    )
  );
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      toArrayBuffer(encodeText(unsigned))
    )
  );
  return `${unsigned}.${bytesToBase64Url(derSignatureToJose(signature))}`;
}

async function encryptPayload(
  subscription: Pick<PushSubscriptionRow, "p256dh" | "auth_key">,
  payload: PushPayload
): Promise<Uint8Array> {
  const uaPublic = decodeKey(subscription.p256dh, 65, "p256dh");
  const authSecret = decodeKey(subscription.auth_key, 16, "auth");
  const plaintext = encodeText(
    JSON.stringify({
      title: payload.title.slice(0, 200),
      body: payload.body?.slice(0, 500) ?? "",
      href: payload.href ?? "/notifications",
      tag: payload.tag ?? undefined,
    })
  );
  if (plaintext.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("Push payload is too large");
  }

  const receiverKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const senderKeys = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiverKey },
      senderKeys.privateKey,
      256
    )
  );
  const senderPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderKeys.publicKey)
  );

  const keyInfo = concatBytes(
    encodeText("WebPush: info\0"),
    uaPublic,
    senderPublic
  );
  const prkKey = await hmacSha256(authSecret, sharedSecret);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(
    prk,
    encodeText("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdfExpand(
    prk,
    encodeText("Content-Encoding: nonce\0"),
    12
  );
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(cek),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce), tagLength: 128 },
      aesKey,
      toArrayBuffer(concatBytes(plaintext, new Uint8Array([2])))
    )
  );
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([senderPublic.byteLength]),
    senderPublic,
    ciphertext
  );
}

export async function buildWebPushRequest(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: PushPayload;
  config: PushConfig;
}): Promise<Request> {
  const subscription = {
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth_key: input.auth,
  };
  const body = await encryptPayload(subscription, input.payload);
  const token = await createVapidToken(input.endpoint, input.config);
  return new Request(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${input.config.publicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "300",
      Urgency: "normal",
    },
    body: toArrayBuffer(body),
  });
}

async function recordPushFailure(id: string) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE push_subscriptions
       SET failure_count = failure_count + 1,
           disabled_at = CASE
             WHEN failure_count + 1 >= ? THEN datetime('now')
             ELSE disabled_at
           END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(MAX_FAILURES, id)
    .run();
}

export async function deliverPushToUser(input: {
  userId: string;
  payload: PushPayload;
}) {
  const config = await getPushConfig();
  if (!config) return { attempted: 0, delivered: 0 };
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, endpoint, p256dh, auth_key
       FROM push_subscriptions
       WHERE user_id = ? AND disabled_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 20`
    )
    .bind(input.userId)
    .all<PushSubscriptionRow>();

  let delivered = 0;
  for (const subscription of results ?? []) {
    try {
      const request = await buildWebPushRequest({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
        payload: input.payload,
        config,
      });
      const response = await fetch(request);
      if (response.status === 404 || response.status === 410) {
        await db
          .prepare(`DELETE FROM push_subscriptions WHERE id = ?`)
          .bind(subscription.id)
          .run();
        continue;
      }
      if (!response.ok) {
        await recordPushFailure(subscription.id);
        continue;
      }
      delivered += 1;
      await db
        .prepare(
          `UPDATE push_subscriptions
           SET failure_count = 0,
               last_success_at = datetime('now'),
               updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(subscription.id)
        .run();
    } catch (error) {
      console.error("push delivery failed", error);
      await recordPushFailure(subscription.id).catch(() => {
        // delivery failures must not affect the primary request
      });
    }
  }
  return { attempted: results?.length ?? 0, delivered };
}

async function runInBackground(task: () => Promise<void>) {
  const safeTask = () => task().catch((error) => {
    console.error("background push task failed", error);
  });
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx?.waitUntil) {
      ctx.waitUntil(safeTask());
      return;
    }
  } catch {
    // next-dev has no waitUntil context
  }
  void safeTask();
}

export function queuePushDelivery(input: {
  userId: string;
  payload: PushPayload;
}) {
  void runInBackground(async () => {
    await deliverPushToUser(input);
  });
}
