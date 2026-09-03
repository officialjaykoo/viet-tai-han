import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";

import {
  LISTING_KINDS,
  LISTING_REPORT_REASONS,
  LISTING_STATUSES,
  type ListingKind,
  type ListingReportReason,
  type ListingStatus,
} from "@/lib/marketplace-constants";

export {
  LISTING_KINDS,
  LISTING_REPORT_REASONS,
  LISTING_STATUSES,
} from "@/lib/marketplace-constants";
export type {
  ListingKind,
  ListingReportReason,
  ListingStatus,
} from "@/lib/marketplace-constants";

export type ListingAuthor = {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isOwner: boolean;
};

export type ListingSummary = {
  id: string;
  kind: ListingKind;
  category: string;
  title: string;
  body: string;
  price: string | null;
  location: string;
  status: ListingStatus;
  createdAt: string;
  saved: boolean;
  seller: ListingAuthor;
};

export type ListingDetail = ListingSummary;

export type ListingFilters = {
  query?: string | null;
  kind?: ListingKind | null;
  category?: string | null;
  location?: string | null;
  status?: ListingStatus | "all" | null;
  savedOnly?: boolean;
  limit?: number;
  viewerUserId?: string | null;
};

export type ListingAlert = {
  id: string;
  query: string;
  kind: ListingKind | null;
  category: string;
  location: string;
  isActive: boolean;
  createdAt: string;
};

export type ListingReportQueueItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingKind: ListingKind;
  listingStatus: ListingStatus;
  reporterUsername: string | null;
  sellerUsername: string | null;
  reason: ListingReportReason;
  details: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
};

type ListingRow = {
  id: string;
  kind: ListingKind;
  category: string;
  title: string;
  body: string;
  price: string | null;
  location: string;
  status: ListingStatus;
  created_at: string;
  seller_id: string;
  seller_username: string | null;
  seller_display_name: string | null;
  seller_image: string | null;
  is_saved?: number | null;
};

function isListingKind(value: string): value is ListingKind {
  return (LISTING_KINDS as readonly string[]).includes(value);
}

function isListingStatus(value: string): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}

function mapListing(
  row: ListingRow,
  viewerUserId?: string | null
): ListingSummary {
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    title: row.title,
    body: row.body,
    price: row.price,
    location: row.location,
    status: row.status,
    createdAt: row.created_at,
    saved: Boolean(row.is_saved),
    seller: {
      id: row.seller_id,
      username: row.seller_username,
      displayName: row.seller_display_name,
      image: row.seller_image,
      isOwner: Boolean(viewerUserId && viewerUserId === row.seller_id),
    },
  };
}

function normalizeText(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function likeContains(value: string) {
  const escaped = value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

function clampLimit(value: number | undefined, fallback = 40) {
  return Math.min(Math.max(value ?? fallback, 1), 100);
}

const DIRECT_CONTACT_PATTERN =
  /(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b|(?:kakao(?:talk)?|카카오톡|zalo|telegram|whatsapp)\s*[:@])/i;

function assertNoDirectContact(text: string) {
  if (DIRECT_CONTACT_PATTERN.test(text)) {
    throw new AuthError("Direct contact details are not allowed in listings", 400);
  }
}

export async function listListings(
  options: ListingFilters = {}
): Promise<ListingSummary[]> {
  const db = await getDb();
  const where = ["l.status != 'removed'", "l.is_shadow_hidden = 0"];
  const params: Array<string | number> = [];

  if (options.status && options.status !== "all") {
    where.push("l.status = ?");
    params.push(options.status);
  } else if (!options.savedOnly && !options.status) {
    where.push("l.status = 'active'");
  }
  if (options.kind) {
    where.push("l.kind = ?");
    params.push(options.kind);
  }
  const category = normalizeText(options.category, 80);
  if (category) {
    where.push("l.category = ? COLLATE NOCASE");
    params.push(category);
  }
  const location = normalizeText(options.location, 100);
  if (location) {
    where.push("l.location LIKE ? ESCAPE '\\'");
    params.push(likeContains(location));
  }
  const query = normalizeText(options.query, 80);
  if (query) {
    const pattern = likeContains(query);
    where.push(
      `(l.title LIKE ? ESCAPE '\\' OR l.body LIKE ? ESCAPE '\\' OR l.category LIKE ? ESCAPE '\\' OR l.location LIKE ? ESCAPE '\\')`
    );
    params.push(pattern, pattern, pattern, pattern);
  }
  if (options.savedOnly) {
    if (!options.viewerUserId) return [];
    where.push(
      "EXISTS (SELECT 1 FROM listing_saves ls WHERE ls.listing_id = l.id AND ls.user_id = ?)"
    );
    params.push(options.viewerUserId);
  }

  const savedSelect = options.viewerUserId
    ? `EXISTS (
         SELECT 1 FROM listing_saves ls_viewer
         WHERE ls_viewer.listing_id = l.id AND ls_viewer.user_id = ?
       ) AS is_saved`
    : "0 AS is_saved";
  if (options.viewerUserId) params.unshift(options.viewerUserId);

  const { results } = await db
    .prepare(
      `SELECT
         l.id, l.kind, l.category, l.title, l.body, l.price, l.location,
         l.status, l.created_at,
         u.id AS seller_id, u.username AS seller_username,
         COALESCE(u.displayUsername, u.name) AS seller_display_name,
         u.image AS seller_image,
         ${savedSelect}
       FROM listings l
       INNER JOIN "user" u ON u.id = l.seller_id
       WHERE ${where.join(" AND ")}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ?`
    )
    .bind(...params, clampLimit(options.limit))
    .all<ListingRow>();

  return (results ?? []).map((row) => mapListing(row, options.viewerUserId));
}

export async function listSavedListings(viewerUserId: string) {
  return listListings({
    savedOnly: true,
    status: "all",
    viewerUserId,
    limit: 100,
  });
}

export async function getListingDetail(
  listingId: string,
  viewerUserId?: string | null
): Promise<ListingDetail | null> {
  const db = await getDb();
  const viewerParam = viewerUserId ?? "";
  const row = await db
    .prepare(
      `SELECT
         l.id, l.kind, l.category, l.title, l.body, l.price, l.location,
         l.status, l.created_at,
         u.id AS seller_id, u.username AS seller_username,
         COALESCE(u.displayUsername, u.name) AS seller_display_name,
         u.image AS seller_image,
         EXISTS (
           SELECT 1 FROM listing_saves ls
           WHERE ls.listing_id = l.id AND ls.user_id = ?
         ) AS is_saved
       FROM listings l
       INNER JOIN "user" u ON u.id = l.seller_id
       WHERE l.id = ?
         AND l.status != 'removed'
         AND l.is_shadow_hidden = 0`
    )
    .bind(viewerParam, listingId)
    .first<ListingRow>();

  return row ? mapListing(row, viewerUserId) : null;
}

export async function createListing(input: {
  sellerId: string;
  sellerStatus?: string | null;
  kind: string;
  category: string;
  title: string;
  body: string;
  price?: string | null;
  location: string;
}) {
  if (!isListingKind(input.kind)) {
    throw new AuthError("Invalid listing type", 400);
  }
  const category = normalizeText(input.category, 80);
  const title = normalizeText(input.title, 200);
  const body = normalizeText(input.body, 10_000);
  const price = normalizeText(input.price, 80) || null;
  const location = normalizeText(input.location, 100);

  if (category.length < 2) {
    throw new AuthError("Category must be 2–80 characters", 400);
  }
  if (title.length < 3) {
    throw new AuthError("Title must be 3–200 characters", 400);
  }
  if (body.length < 10) {
    throw new AuthError("Listing must be 10–10000 characters", 400);
  }
  if (location.length < 2) {
    throw new AuthError("Location must be 2–100 characters", 400);
  }
  assertNoDirectContact(`${title}\n${body}\n${location}`);

  await enforceCreateRateLimit(input.sellerId, "listing");
  const moderation = await moderateText(`${title}\n${body}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const db = await getDb();
  const seller = await db
    .prepare(`SELECT id FROM "user" WHERE id = ? AND status != 'banned'`)
    .bind(input.sellerId)
    .first<{ id: string }>();
  if (!seller) throw new AuthError("User not found", 404);

  const id = createPublicId();
  const shadow =
    moderation.shadow || input.sellerStatus === "shadowbanned" ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO listings (
         id, seller_id, kind, category, title, body, price, location,
         is_shadow_hidden
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.sellerId,
      input.kind,
      category,
      title,
      body,
      price,
      location,
      shadow
    )
    .run();

  return { id };
}

export async function updateListingStatus(input: {
  listingId: string;
  sellerId: string;
  status: string;
}) {
  if (!isListingStatus(input.status) || input.status === "removed") {
    throw new AuthError("Invalid listing status", 400);
  }
  const db = await getDb();
  const result = await db
    .prepare(
      `UPDATE listings
       SET status = ?, updated_at = datetime('now')
       WHERE id = ? AND seller_id = ? AND status != 'removed'`
    )
    .bind(input.status, input.listingId, input.sellerId)
    .run();
  if (!result.meta.changes) {
    const row = await db
      .prepare(`SELECT id, seller_id, status FROM listings WHERE id = ?`)
      .bind(input.listingId)
      .first<{ id: string; seller_id: string; status: ListingStatus }>();
    if (!row) throw new AuthError("Listing not found", 404);
    if (row.seller_id !== input.sellerId) {
      throw new AuthError("Only the seller can update this listing", 403);
    }
    if (row.status === "removed") {
      throw new AuthError("Listing not found", 404);
    }
  }
  return { status: input.status as Exclude<ListingStatus, "removed"> };
}

export async function toggleListingSave(input: {
  listingId: string;
  userId: string;
}) {
  const db = await getDb();
  const listing = await db
    .prepare(
      `SELECT id FROM listings
       WHERE id = ? AND status != 'removed' AND is_shadow_hidden = 0`
    )
    .bind(input.listingId)
    .first<{ id: string }>();
  if (!listing) throw new AuthError("Listing not found", 404);

  const existing = await db
    .prepare(
      `SELECT 1 AS saved FROM listing_saves WHERE listing_id = ? AND user_id = ?`
    )
    .bind(input.listingId, input.userId)
    .first();
  if (existing) {
    await db
      .prepare(
        `DELETE FROM listing_saves WHERE listing_id = ? AND user_id = ?`
      )
      .bind(input.listingId, input.userId)
      .run();
    return { saved: false as const };
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO listing_saves (listing_id, user_id) VALUES (?, ?)`
    )
    .bind(input.listingId, input.userId)
    .run();
  return { saved: true as const };
}

export async function createListingAlert(input: {
  userId: string;
  query?: string | null;
  kind?: string | null;
  category?: string | null;
  location?: string | null;
}) {
  const query = normalizeText(input.query, 80);
  const kind = normalizeText(input.kind, 20);
  const category = normalizeText(input.category, 80);
  const location = normalizeText(input.location, 100);
  if (kind && !isListingKind(kind)) {
    throw new AuthError("Invalid listing type", 400);
  }
  if (!query && !kind && !category && !location) {
    throw new AuthError("Add a search filter before saving an alert", 400);
  }

  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO listing_alerts (id, user_id, query, kind, category, location)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, query, kind, category, location)
       DO UPDATE SET is_active = 1`
    )
    .bind(createPublicId(), input.userId, query, kind, category, location)
    .run();
  const alert = await db
    .prepare(
      `SELECT id, query, kind, category, location, is_active, created_at
       FROM listing_alerts
       WHERE user_id = ? AND query = ? AND kind = ? AND category = ? AND location = ?`
    )
    .bind(input.userId, query, kind, category, location)
    .first<{
      id: string;
      query: string;
      kind: string;
      category: string;
      location: string;
      is_active: number;
      created_at: string;
    }>();
  if (!alert) throw new AuthError("Could not save search alert", 500);
  return mapAlert(alert);
}

function mapAlert(row: {
  id: string;
  query: string;
  kind: string;
  category: string;
  location: string;
  is_active: number;
  created_at: string;
}): ListingAlert {
  return {
    id: row.id,
    query: row.query,
    kind: row.kind && isListingKind(row.kind) ? row.kind : null,
    category: row.category,
    location: row.location,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function listListingAlerts(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, query, kind, category, location, is_active, created_at
       FROM listing_alerts WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`
    )
    .bind(userId)
    .all<{
      id: string;
      query: string;
      kind: string;
      category: string;
      location: string;
      is_active: number;
      created_at: string;
    }>();
  return (results ?? []).map(mapAlert);
}

export async function deleteListingAlert(input: {
  userId: string;
  alertId: string;
}) {
  const db = await getDb();
  await db
    .prepare(`DELETE FROM listing_alerts WHERE id = ? AND user_id = ?`)
    .bind(input.alertId, input.userId)
    .run();
  return { deleted: true as const };
}

export async function reportListing(input: {
  listingId: string;
  reporterId: string;
  reason: string;
  details?: string | null;
}) {
  if (!(LISTING_REPORT_REASONS as readonly string[]).includes(input.reason)) {
    throw new AuthError("Invalid report reason", 400);
  }
  const db = await getDb();
  const listing = await db
    .prepare(
      `SELECT id, seller_id FROM listings
       WHERE id = ? AND status != 'removed' AND is_shadow_hidden = 0`
    )
    .bind(input.listingId)
    .first<{ id: string; seller_id: string }>();
  if (!listing) throw new AuthError("Listing not found", 404);
  if (listing.seller_id === input.reporterId) {
    throw new AuthError("You can't report your own listing", 400);
  }

  const details = normalizeText(input.details, 500) || null;
  const id = createPublicId();
  try {
    await db
      .prepare(
        `INSERT INTO listing_reports (
           id, listing_id, reporter_id, reason, details
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, input.listingId, input.reporterId, input.reason, details)
      .run();
  } catch {
    throw new AuthError("You already reported this listing", 409);
  }
  return { reported: true as const };
}

export async function listListingReportQueue(
  status: "open" | "reviewed" | "dismissed" = "open"
): Promise<ListingReportQueueItem[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.listing_id, l.title AS listing_title, l.kind AS listing_kind,
         l.status AS listing_status,
         reporter.username AS reporter_username,
         seller.username AS seller_username,
         r.reason, r.details, r.status, r.created_at
       FROM listing_reports r
       INNER JOIN listings l ON l.id = r.listing_id
       INNER JOIN "user" reporter ON reporter.id = r.reporter_id
       INNER JOIN "user" seller ON seller.id = l.seller_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC, r.id ASC
       LIMIT 50`
    )
    .bind(status)
    .all<{
      id: string;
      listing_id: string;
      listing_title: string;
      listing_kind: ListingKind;
      listing_status: ListingStatus;
      reporter_username: string | null;
      seller_username: string | null;
      reason: ListingReportReason;
      details: string | null;
      status: "open" | "reviewed" | "dismissed";
      created_at: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingKind: row.listing_kind,
    listingStatus: row.listing_status,
    reporterUsername: row.reporter_username,
    sellerUsername: row.seller_username,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function reviewListingReport(input: {
  reportId: string;
  reviewerId: string;
  status: "reviewed" | "dismissed";
  removeListing?: boolean;
  resolutionNote?: string | null;
}) {
  const db = await getDb();
  const report = await db
    .prepare(`SELECT id, listing_id FROM listing_reports WHERE id = ?`)
    .bind(input.reportId)
    .first<{ id: string; listing_id: string }>();
  if (!report) throw new AuthError("Listing report not found", 404);

  const note = normalizeText(input.resolutionNote, 500) || null;
  const statements = [
    db
      .prepare(
        `UPDATE listing_reports
         SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), resolution_note = ?
         WHERE id = ?`
      )
      .bind(input.status, input.reviewerId, note, input.reportId),
  ];
  if (input.removeListing) {
    statements.push(
      db
        .prepare(
          `UPDATE listings SET status = 'removed', updated_at = datetime('now')
           WHERE id = ? AND status != 'removed'`
        )
        .bind(report.listing_id)
    );
  }
  await db.batch(statements);
  return { status: input.status, listingRemoved: Boolean(input.removeListing) };
}

export function serializeListingSummary(listing: ListingSummary) {
  return {
    id: listing.id,
    kind: listing.kind,
    category: listing.category,
    title: listing.title,
    body: listing.body,
    price: listing.price,
    location: listing.location,
    status: listing.status,
    createdAt: listing.createdAt,
    saved: listing.saved,
    seller: {
      username: listing.seller.username,
      displayName: listing.seller.displayName,
      image: listing.seller.image,
      isOwner: listing.seller.isOwner,
    },
  };
}

export function serializeListingDetail(listing: ListingDetail) {
  return serializeListingSummary(listing);
}
