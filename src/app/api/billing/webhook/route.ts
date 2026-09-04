import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/lib/db";
import {
  parseBillingEvent,
  processBillingEvent,
  verifyBillingSignature,
} from "@/lib/monetization";
import { sha256Hex } from "@/lib/security/crypto";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError } from "@/lib/session";

const MAX_WEBHOOK_BYTES = 128_000;

export async function POST(request: NextRequest) {
  const env = (await getEnv()) as CloudflareEnv & {
    BILLING_WEBHOOK_SECRET?: string;
  };
  const secret = env.BILLING_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return await jsonLocalizedError("Billing webhook is not configured", 503);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BYTES) {
    return await jsonLocalizedError("Billing payload is too large", 413);
  }
  const providedSignature = (request.headers.get("x-vth-billing-signature") ?? "")
    .trim()
    .replace(/^sha256=/i, "");
  if (
    !(await verifyBillingSignature({
      secret,
      body: raw,
      signature: providedSignature,
    }))
  ) {
    return await jsonLocalizedError("Invalid billing signature", 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    return await jsonLocalizedError("Billing payload must be JSON", 415);
  }

  try {
    const event = parseBillingEvent(JSON.parse(raw) as unknown);
    const result = await processBillingEvent({
      event,
      payloadHash: await sha256Hex(raw),
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      eventId: event.eventId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/billing/webhook failed", error);
    return await jsonLocalizedError("Billing event could not be processed", 400);
  }
}
