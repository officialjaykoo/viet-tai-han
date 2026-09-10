import { NextResponse } from "next/server";

import { localizeErrorMessage } from "@/lib/i18n/errors";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  buildInternalApiResponse,
  PROTOBUF_CONTENT_TYPE,
  type InternalApiResponse,
} from "@/lib/security/protobuf";
import {
  ATK_COOKIE,
  GATE_NAME_COOKIE,
  GATE_VALUE_COOKIE,
  SEC_COOKIE,
} from "@/lib/security/shared";
import { AuthError } from "@/lib/session";

const FORWARD_HEADERS = ["set-cookie", "etag", "x-content-type-options"] as const;
const API_GUARD_EXPIRY =
  "Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0";
const API_GUARD_COOKIES = [
  { name: ATK_COOKIE, httpOnly: false },
  { name: SEC_COOKIE, httpOnly: true },
  { name: GATE_NAME_COOKIE, httpOnly: false },
  { name: GATE_VALUE_COOKIE, httpOnly: false },
] as const;

export type WrapOptions = {
  /** ATK used to seal the response payload (hides JSON on the wire). */
  sealAtk?: string | null;
  /** Expire VTH's ephemeral API guard after a successful logout. */
  expireApiGuardCookies?: boolean;
  /** Match the challenge cookie's Secure attribute. */
  secure?: boolean;
};

function readAtkFromSetCookie(response: Response): string | null {
  const bags =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const single = response.headers.get("set-cookie");
  const all = bags.length > 0 ? bags : single ? [single] : [];
  for (const entry of all) {
    const match = entry.match(new RegExp(`(?:^|,\\s*)${ATK_COOKIE}=([^;]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Wrap a logical handler Response as POST /i/api Protobuf.
 * HTTP status is always 200 when the tunnel delivered a frame; logical status
 * lives inside InternalApiResponse. Set-Cookie is forwarded on the HTTP layer.
 */
export async function wrapAsProtobufResponse(
  inner: Response,
  options: WrapOptions = {}
): Promise<NextResponse> {
  const body = new Uint8Array(await inner.arrayBuffer());
  const contentType = inner.headers.get("content-type") ?? "";
  const sealAtk = options.sealAtk || readAtkFromSetCookie(inner);

  const frame = await buildInternalApiResponse(
    {
      status: inner.status,
      contentType,
      body,
      gateName: "",
      gateValue: "",
    },
    sealAtk
  );

  const headers = new Headers();
  headers.set("Content-Type", PROTOBUF_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");

  for (const name of FORWARD_HEADERS) {
    const values =
      typeof inner.headers.getSetCookie === "function" && name === "set-cookie"
        ? inner.headers.getSetCookie()
        : null;
    if (values && values.length > 0) {
      for (const value of values) {
        headers.append("Set-Cookie", value);
      }
      continue;
    }
    const single = inner.headers.get(name);
    if (single) headers.set(name, single);
  }
  if (options.expireApiGuardCookies) {
    const secure = options.secure ?? true;
    const secureAttribute = secure ? "; Secure" : "";
    for (const cookie of API_GUARD_COOKIES) {
      headers.append(
        "Set-Cookie",
        `${cookie.name}=; ${API_GUARD_EXPIRY}${secureAttribute}; SameSite=Lax${
          cookie.httpOnly ? "; HttpOnly" : ""
        }`
      );
    }
  }

  return new NextResponse(new Uint8Array(frame), {
    status: 200,
    headers,
  });
}

export async function protobufJsonError(
  message: string,
  status: number,
  options: WrapOptions = {}
): Promise<NextResponse> {
  const { locale } = await getRequestLocale();
  const localized = localizeErrorMessage(message, locale);
  const body = new TextEncoder().encode(JSON.stringify({ error: localized }));
  return wrapAsProtobufResponse(
    new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    options
  );
}

export async function protobufAuthError(
  error: unknown,
  options: WrapOptions = {}
): Promise<NextResponse> {
  if (error instanceof AuthError) {
    return protobufJsonError(error.message, error.status, options);
  }
  throw error;
}

export function encodeErrorFrame(
  message: string,
  status: number
): Omit<InternalApiResponse, "sealedPayload"> & { sealedPayload?: Uint8Array } {
  return {
    status,
    contentType: "application/json",
    body: new TextEncoder().encode(JSON.stringify({ error: message })),
    gateName: "",
    gateValue: "",
    sealedPayload: new Uint8Array(),
  };
}
