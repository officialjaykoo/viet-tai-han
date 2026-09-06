import { describe, expect, it } from "vitest";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  hmacSha256,
} from "@/lib/security/crypto";
import {
  buildWebPushRequest,
  inspectPushConfigValues,
  type PushConfig,
} from "@/lib/push";

function buffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const blocks: Uint8Array[] = [];
  let previous = new Uint8Array(0);
  for (let counter = 1; counter <= Math.ceil(length / 32); counter++) {
    previous = await hmacSha256(
      prk,
      concat(previous, info, new Uint8Array([counter]))
    );
    blocks.push(previous);
  }
  return concat(...blocks).slice(0, length);
}

describe("VAPID configuration", () => {
  const publicKey = bytesToBase64Url(
    Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index))
  );
  const privateKey = bytesToBase64Url(
    Uint8Array.from({ length: 32 }, (_, index) => index + 1)
  );

  it("distinguishes missing configuration", () => {
    expect(inspectPushConfigValues({})).toEqual({
      state: "missing",
      publicKey: null,
    });
  });

  it("rejects malformed keys or subject", () => {
    expect(
      inspectPushConfigValues({
        publicKey: "not-a-key",
        privateKey,
        subject: "http://vth.kr",
      })
    ).toEqual({ state: "invalid", publicKey: null });
  });

  it("accepts an uncompressed P-256 key pair and valid subject", () => {
    expect(
      inspectPushConfigValues({
        publicKey,
        privateKey,
        subject: "mailto:ops@vth.kr",
      })
    ).toEqual({ state: "configured", publicKey });
  });
});

describe("Web Push encryption", () => {
  it("builds an RFC 8188 request that the subscription can decrypt", async () => {
    const browserKeys = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    )) as CryptoKeyPair;
    const browserJwk = (await crypto.subtle.exportKey(
      "jwk",
      browserKeys.privateKey
    )) as JsonWebKey;
    const browserPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", browserKeys.publicKey)
    );
    const auth = new Uint8Array(16);
    crypto.getRandomValues(auth);

    const vapidKeys = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair;
    const vapidJwk = (await crypto.subtle.exportKey(
      "jwk",
      vapidKeys.privateKey
    )) as JsonWebKey;
    const vapidPublic = concat(
      new Uint8Array([4]),
      base64UrlToBytes(vapidJwk.x!),
      base64UrlToBytes(vapidJwk.y!)
    );
    const config: PushConfig = {
      publicKey: bytesToBase64Url(vapidPublic),
      privateKey: vapidJwk.d!,
      subject: "mailto:test@example.com",
    };

    const request = await buildWebPushRequest({
      endpoint: "https://push.example.test/send/123",
      p256dh: bytesToBase64Url(browserPublic),
      auth: bytesToBase64Url(auth),
      payload: {
        title: "New chat",
        body: "A message arrived",
        href: "/messages?room=room_test",
      },
      config,
    });

    expect(request.method).toBe("POST");
    expect(request.headers.get("Content-Encoding")).toBe("aes128gcm");
    expect(request.headers.get("Authorization")).toMatch(/^vapid t=.+, k=.+$/);

    const body = new Uint8Array(await request.arrayBuffer());
    const salt = body.slice(0, 16);
    const serverPublic = body.slice(21, 86);
    const ciphertext = body.slice(86);
    const receiver = await crypto.subtle.importKey(
      "jwk",
      browserJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );
    const sender = await crypto.subtle.importKey(
      "raw",
      buffer(serverPublic),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: sender },
        receiver,
        256
      )
    );
    const keyInfo = concat(
      new TextEncoder().encode("WebPush: info\0"),
      browserPublic,
      serverPublic
    );
    const prkKey = await hmacSha256(auth, shared);
    const ikm = await hkdfExpand(prkKey, keyInfo, 32);
    const prk = await hmacSha256(salt, ikm);
    const cek = await hkdfExpand(
      prk,
      new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
      16
    );
    const nonce = await hkdfExpand(
      prk,
      new TextEncoder().encode("Content-Encoding: nonce\0"),
      12
    );
    const key = await crypto.subtle.importKey(
      "raw",
      buffer(cek),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buffer(nonce), tagLength: 128 },
        key,
        buffer(ciphertext)
      )
    );
    expect(plaintext.at(-1)).toBe(2);
    expect(JSON.parse(new TextDecoder().decode(plaintext.slice(0, -1)))).toEqual({
      title: "New chat",
      body: "A message arrived",
      href: "/messages?room=room_test",
    });
  });
});
