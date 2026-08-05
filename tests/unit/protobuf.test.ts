import { describe, expect, it } from "vitest";

import {
  buildInternalApiResponse,
  decodeInternalApiRequest,
  decodeInternalApiResponse,
  encodeInternalApiRequest,
  encodeInternalApiResponse,
  resolveInternalApiResponse,
} from "@/lib/security/protobuf";
import { buildCanonical } from "@/lib/security/shared";

describe("InternalApiRequest protobuf", () => {
  it("round-trips sealed route fields without plaintext path", async () => {
    const payload = new TextEncoder().encode('{"action":"upvote"}');
    const signature = new Uint8Array([1, 2, 3, 4]);
    const atk = "test-atk-key-material-32bytes!!";
    const encoded = await encodeInternalApiRequest(
      {
        method: "POST",
        path: "/api/posts/abc/vote",
        query: "sort=hot",
        timestampMs: 1_700_000_000_000,
        nonce: "deadbeefdeadbeef",
        payload,
        signature,
        challengeId: "chal123",
        powNonce: 42,
        contentType: "application/json",
        filename: "",
      },
      atk
    );

    const asText = new TextDecoder().decode(encoded);
    expect(asText.includes("/api/posts")).toBe(false);
    expect(asText.includes("POST")).toBe(false);
    expect(asText.includes("sort=hot")).toBe(false);

    const decoded = await decodeInternalApiRequest(encoded, atk);
    expect(decoded.method).toBe("POST");
    expect(decoded.path).toBe("/api/posts/abc/vote");
    expect(decoded.query).toBe("sort=hot");
  });

  it("bootstraps challenge without ATK via route id", async () => {
    const encoded = await encodeInternalApiRequest(
      {
        method: "GET",
        path: "/api/security/challenge",
        query: "",
        timestampMs: Date.now(),
        nonce: "",
        payload: new Uint8Array(),
        signature: new Uint8Array(),
        challengeId: "",
        powNonce: 0,
        contentType: "",
        filename: "",
      },
      null
    );
    const asText = new TextDecoder().decode(encoded);
    expect(asText.includes("/api/security/challenge")).toBe(false);

    const decoded = await decodeInternalApiRequest(encoded, null);
    expect(decoded.method).toBe("GET");
    expect(decoded.path).toBe("/api/security/challenge");
  });
});

describe("InternalApiResponse protobuf", () => {
  it("seals JSON so content-type is not visible as UTF-8", async () => {
    const atk = "test-atk-key-material-32bytes!!";
    const body = new TextEncoder().encode('{"ok":true}');
    const encoded = await buildInternalApiResponse(
      {
        status: 201,
        contentType: "application/json",
        body,
        gateName: "",
        gateValue: "",
      },
      atk
    );
    const asText = new TextDecoder().decode(encoded);
    expect(asText.includes("application/json")).toBe(false);
    expect(asText.includes('"ok"')).toBe(false);

    const resolved = await resolveInternalApiResponse(encoded, atk);
    expect(resolved.status).toBe(201);
    expect(resolved.contentType).toBe("application/json");
    expect([...resolved.body]).toEqual([...body]);
  });

  it("round-trips unsealed bootstrap frames", () => {
    const body = new TextEncoder().encode('{"ok":true}');
    const encoded = encodeInternalApiResponse({
      status: 201,
      contentType: "application/json",
      body,
      gateName: "a1b2c",
      gateValue: "deadbeef",
      sealedPayload: new Uint8Array(),
    });
    const decoded = decodeInternalApiResponse(encoded);
    expect(decoded.status).toBe(201);
    expect(decoded.contentType).toBe("application/json");
    expect([...decoded.body]).toEqual([...body]);
  });
});

describe("buildCanonical", () => {
  it("binds method path query payload and challenge (v2)", () => {
    expect(
      buildCanonical({
        method: "post",
        path: "/api/x",
        query: "a=1",
        timestampMs: 1,
        nonce: "n",
        challengeId: "c",
        payloadHashHex: "abc",
        powNonce: 9,
      })
    ).toBe("v2\nPOST\n/api/x\na=1\n1\nn\nc\nabc\n9");
  });
});
