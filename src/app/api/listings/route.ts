import { NextRequest, NextResponse } from "next/server";

import {
  createListing,
  LISTING_KINDS,
  LISTING_STATUSES,
  listListings,
  serializeListingSummary,
} from "@/lib/marketplace";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import { readApiJson } from "@/lib/security/guard";
import {
  AuthError,
  getSession,
  jsonAuthError,
  requireSession,
} from "@/lib/session";

function isKind(value: string): value is (typeof LISTING_KINDS)[number] {
  return (LISTING_KINDS as readonly string[]).includes(value);
}

function isStatus(value: string): value is (typeof LISTING_STATUSES)[number] {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const params = request.nextUrl.searchParams;
    const kindParam = params.get("kind");
    const statusParam = params.get("status");
    const rawLimit = params.get("limit");
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    if (rawLimit && Number.isNaN(limit)) {
      return await jsonLocalizedError("Invalid limit", 400);
    }
    if (kindParam && !isKind(kindParam)) {
      return await jsonLocalizedError("Invalid listing type", 400);
    }
    if (statusParam && statusParam !== "all" && !isStatus(statusParam)) {
      return await jsonLocalizedError("Invalid listing status", 400);
    }

    const listings = await listListings({
      query: params.get("q"),
      kind: kindParam as (typeof LISTING_KINDS)[number] | null,
      category: params.get("category"),
      location: params.get("location"),
      status: statusParam as
        | (typeof LISTING_STATUSES)[number]
        | "all"
        | null,
      savedOnly: params.get("saved") === "1",
      limit,
      viewerUserId: session?.user?.id ?? null,
    });
    return NextResponse.json({
      listings: listings.map(serializeListingSummary),
    });
  } catch (error) {
    console.error("GET /api/listings failed", error);
    return await jsonLocalizedError("Failed to load listings", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = requireBotAttestation(await readApiJson(request)) as {
      kind?: string;
      category?: string;
      title?: string;
      body?: string;
      price?: string | null;
      location?: string;
    };
    if (
      !body.kind ||
      !body.category ||
      !body.title ||
      !body.body ||
      !body.location
    ) {
      return await jsonLocalizedError("Required listing fields are missing", 400);
    }

    const user = session.user as { id: string; status?: string | null };
    const result = await createListing({
      sellerId: user.id,
      sellerStatus: user.status,
      kind: body.kind,
      category: body.category,
      title: body.title,
      body: body.body,
      price: body.price,
      location: body.location,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/listings failed", error);
    return await jsonLocalizedError("Failed to create listing", 500);
  }
}
