import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import {
  BOOKING_STATUSES,
  BUSINESS_STATUSES,
  BUSINESS_VERIFICATION_STATUSES,
  type BookingStatus,
  type BusinessStatus,
  type BusinessVerificationStatus,
} from "@/lib/business-constants";
import { AuthError } from "@/lib/session";

export type BusinessOwner = {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isOwner: boolean;
};

export type BusinessService = {
  id: string;
  name: string;
  description: string;
  price: string | null;
  durationMinutes: number;
  isActive: boolean;
};

export type BusinessVerification = {
  id: string;
  status: "pending" | "approved" | "rejected";
  evidence: string;
  resolutionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type BusinessSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  address: string;
  location: string;
  phone: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  status: BusinessStatus;
  verificationStatus: BusinessVerificationStatus;
  serviceCount: number;
  createdAt: string;
  owner: BusinessOwner;
};

export type BusinessDetail = BusinessSummary & {
  services: BusinessService[];
  latestVerification: BusinessVerification | null;
};

export type BusinessFilters = {
  query?: string | null;
  category?: string | null;
  location?: string | null;
  status?: BusinessStatus | "all" | null;
  viewerUserId?: string | null;
  ownerOnly?: boolean;
  limit?: number;
};

export type BusinessVerificationQueueItem = {
  id: string;
  businessId: string;
  businessSlug: string;
  businessName: string;
  category: string;
  location: string;
  ownerUsername: string | null;
  ownerName: string;
  evidence: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type BusinessBooking = {
  id: string;
  businessId: string;
  businessSlug: string;
  businessName: string;
  serviceId: string | null;
  serviceName: string | null;
  requesterId: string;
  requesterUsername: string | null;
  requesterName: string;
  startAt: string;
  durationMinutes: number;
  note: string | null;
  status: BookingStatus;
  ownerNote: string | null;
  createdAt: string;
  isOwner: boolean;
};

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  address: string;
  location: string;
  phone: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: string | null;
  status: BusinessStatus;
  verification_status: BusinessVerificationStatus;
  service_count: number;
  created_at: string;
  owner_id: string;
  owner_username: string | null;
  owner_name: string;
  owner_image: string | null;
  is_owner?: number | null;
};

type ServiceInput = {
  name: string;
  description?: string | null;
  price?: string | null;
  durationMinutes?: number;
};

function isBusinessStatus(value: string): value is BusinessStatus {
  return (BUSINESS_STATUSES as readonly string[]).includes(value);
}

function isVerificationStatus(value: string): value is BusinessVerificationStatus {
  return (BUSINESS_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

function normalizeText(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function normalizeUrl(value: string | null | undefined) {
  const raw = normalizeText(value, 300);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuthError("Website must be a valid URL", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuthError("Website must use http or https", 400);
  }
  return url.toString();
}

function normalizeCoordinate(
  value: number | string | null | undefined,
  min: number,
  max: number,
  label: string
) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new AuthError(`${label} is invalid`, 400);
  }
  return number;
}

function slugifyBusinessName(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "business";
}

async function uniqueBusinessSlug(
  db: D1Database,
  name: string,
  id: string
): Promise<string> {
  const base = slugifyBusinessName(name);
  const existing = await db
    .prepare(`SELECT id FROM businesses WHERE slug = ? COLLATE NOCASE`)
    .bind(base)
    .first<{ id: string }>();
  if (!existing) return base;
  return `${base.slice(0, 48)}-${id.slice(0, 7).toLowerCase()}`;
}

function normalizeServices(input: ServiceInput[] | undefined) {
  if (input === undefined) return [] as Array<{
    name: string;
    description: string;
    price: string | null;
    durationMinutes: number;
  }>;
  if (!Array.isArray(input) || input.length > 20) {
    throw new AuthError("A business can have up to 20 services", 400);
  }
  return input.map((service) => {
    const name = normalizeText(service.name, 100);
    const description = normalizeText(service.description, 500);
    const price = normalizeText(service.price, 80) || null;
    const durationMinutes = Number(service.durationMinutes ?? 60);
    if (name.length < 2) {
      throw new AuthError("Service names must be 2–100 characters", 400);
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      throw new AuthError("Service duration must be 15–480 minutes", 400);
    }
    return { name, description, price, durationMinutes };
  });
}

function normalizeBusinessInput(input: {
  name: string;
  description: string;
  category: string;
  address: string;
  location: string;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  openingHours?: string | null;
  services?: ServiceInput[];
}) {
  const name = normalizeText(input.name, 100);
  const description = normalizeText(input.description, 5_000);
  const category = normalizeText(input.category, 80);
  const address = normalizeText(input.address, 200);
  const location = normalizeText(input.location, 100);
  const phone = normalizeText(input.phone, 40) || null;
  const openingHours = normalizeText(input.openingHours, 500) || null;
  if (name.length < 2) throw new AuthError("Business name must be 2–100 characters", 400);
  if (description.length < 10) {
    throw new AuthError("Business description must be 10–5000 characters", 400);
  }
  if (category.length < 2) throw new AuthError("Category must be 2–80 characters", 400);
  if (address.length < 3) throw new AuthError("Address must be 3–200 characters", 400);
  if (location.length < 2) throw new AuthError("Location must be 2–100 characters", 400);
  return {
    name,
    description,
    category,
    address,
    location,
    phone,
    websiteUrl: normalizeUrl(input.websiteUrl),
    latitude: normalizeCoordinate(input.latitude, -90, 90, "Latitude"),
    longitude: normalizeCoordinate(input.longitude, -180, 180, "Longitude"),
    openingHours,
    services: normalizeServices(input.services),
  };
}

function mapOwner(
  row: Pick<
    BusinessRow,
    "owner_id" | "owner_username" | "owner_name" | "owner_image"
  >,
  viewerUserId?: string | null
): BusinessOwner {
  return {
    id: row.owner_id,
    username: row.owner_username,
    displayName: row.owner_name,
    image: row.owner_image,
    isOwner: Boolean(viewerUserId && viewerUserId === row.owner_id),
  };
}

function mapBusiness(row: BusinessRow, viewerUserId?: string | null): BusinessSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    address: row.address,
    location: row.location,
    phone: row.phone,
    websiteUrl: row.website_url,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    openingHours: row.opening_hours,
    status: row.status,
    verificationStatus: row.verification_status,
    serviceCount: Number(row.service_count ?? 0),
    createdAt: row.created_at,
    owner: mapOwner(row, viewerUserId),
  };
}

function mapService(row: {
  id: string;
  name: string;
  description: string;
  price: string | null;
  duration_minutes: number;
  is_active: number;
}): BusinessService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    durationMinutes: Number(row.duration_minutes),
    isActive: Boolean(row.is_active),
  };
}

function mapVerification(row: {
  id: string;
  status: "pending" | "approved" | "rejected";
  evidence: string;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}): BusinessVerification {
  return {
    id: row.id,
    status: row.status,
    evidence: row.evidence,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function clampLimit(value: number | undefined, fallback = 40) {
  return Math.min(Math.max(value ?? fallback, 1), 100);
}

export async function listBusinesses(
  options: BusinessFilters = {}
): Promise<BusinessSummary[]> {
  const db = await getDb();
  const ownerOnly = Boolean(options.ownerOnly && options.viewerUserId);
  const where = ["b.status != 'removed'", "b.is_shadow_hidden = 0"];
  const params: Array<string | number> = [];

  if (ownerOnly) {
    where.push("b.owner_id = ?");
    params.push(options.viewerUserId!);
  } else if (options.viewerUserId) {
    where.push("(b.verification_status = 'verified' OR b.owner_id = ?)");
    params.push(options.viewerUserId);
  } else {
    where.push("b.verification_status = 'verified'");
  }

  if (options.status && options.status !== "all") {
    if (!isBusinessStatus(options.status) || options.status === "removed") {
      throw new AuthError("Invalid business status", 400);
    }
    where.push("b.status = ?");
    params.push(options.status);
  } else if (!options.status && !ownerOnly) {
    where.push("b.status = 'active'");
  }

  const category = normalizeText(options.category, 80);
  if (category) {
    where.push("b.category = ? COLLATE NOCASE");
    params.push(category);
  }
  const location = normalizeText(options.location, 100);
  if (location) {
    where.push("(b.location LIKE ? ESCAPE '\\' OR b.address LIKE ? ESCAPE '\\')");
    const pattern = `%${location.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    params.push(pattern, pattern);
  }
  const query = normalizeText(options.query, 100);
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(
      `(b.name LIKE ? ESCAPE '\\' OR b.description LIKE ? ESCAPE '\\' OR b.category LIKE ? ESCAPE '\\' OR b.location LIKE ? ESCAPE '\\')`
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const ownerSelect = options.viewerUserId
    ? "b.owner_id = ? AS is_owner"
    : "0 AS is_owner";
  if (options.viewerUserId) params.unshift(options.viewerUserId);

  const { results } = await db
    .prepare(
      `SELECT
         b.id, b.slug, b.name, b.description, b.category, b.address, b.location,
         b.phone, b.website_url, b.latitude, b.longitude, b.opening_hours,
         b.status, b.verification_status, b.created_at, b.owner_id,
         u.username AS owner_username, u.name AS owner_name, u.image AS owner_image,
         (SELECT COUNT(*) FROM business_services bs
          WHERE bs.business_id = b.id AND bs.is_active = 1) AS service_count,
         ${ownerSelect}
       FROM businesses b
       INNER JOIN "user" u ON u.id = b.owner_id AND u.status != 'banned'
       WHERE ${where.join(" AND ")}
       ORDER BY b.verification_status = 'verified' DESC, b.created_at DESC, b.id DESC
       LIMIT ?`
    )
    .bind(...params, clampLimit(options.limit))
    .all<BusinessRow>();

  return (results ?? []).map((row) => mapBusiness(row, options.viewerUserId));
}

export async function listOwnedBusinesses(ownerId: string) {
  return listBusinesses({ ownerOnly: true, viewerUserId: ownerId, status: "all", limit: 100 });
}

export async function getBusinessDetail(
  identifier: string,
  viewerUserId?: string | null
): Promise<BusinessDetail | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT
         b.id, b.slug, b.name, b.description, b.category, b.address, b.location,
         b.phone, b.website_url, b.latitude, b.longitude, b.opening_hours,
         b.status, b.verification_status, b.created_at, b.owner_id,
         u.username AS owner_username, u.name AS owner_name, u.image AS owner_image,
         (SELECT COUNT(*) FROM business_services bs
          WHERE bs.business_id = b.id AND bs.is_active = 1) AS service_count
       FROM businesses b
       INNER JOIN "user" u ON u.id = b.owner_id AND u.status != 'banned'
       WHERE (b.slug = ? COLLATE NOCASE OR b.id = ?)
         AND b.status != 'removed'
         AND b.is_shadow_hidden = 0
         AND (b.verification_status = 'verified' OR b.owner_id = ?)`
    )
    .bind(identifier, identifier, viewerUserId ?? "")
    .first<BusinessRow>();
  if (!row) return null;

  const [servicesResult, verification] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, description, price, duration_minutes, is_active
         FROM business_services
         WHERE business_id = ? AND is_active = 1
         ORDER BY created_at ASC, id ASC`
      )
      .bind(row.id)
      .all<{
        id: string;
        name: string;
        description: string;
        price: string | null;
        duration_minutes: number;
        is_active: number;
      }>(),
    db
      .prepare(
        `SELECT id, status, evidence, resolution_note, created_at, reviewed_at
         FROM business_verification_requests
         WHERE business_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .bind(row.id)
      .first<{
        id: string;
        status: "pending" | "approved" | "rejected";
        evidence: string;
        resolution_note: string | null;
        created_at: string;
        reviewed_at: string | null;
      }>(),
  ]);

  return {
    ...mapBusiness(row, viewerUserId),
    services: (servicesResult.results ?? []).map(mapService),
    latestVerification: verification ? mapVerification(verification) : null,
  };
}

export async function createBusiness(input: {
  ownerId: string;
  ownerStatus?: string | null;
  name: string;
  description: string;
  category: string;
  address: string;
  location: string;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  openingHours?: string | null;
  services?: ServiceInput[];
}) {
  const normalized = normalizeBusinessInput(input);
  await enforceCreateRateLimit(input.ownerId, "business");
  const moderation = await moderateText(`${normalized.name}\n${normalized.description}`);
  if (moderation.blocked) throw new AuthError("This content isn't allowed", 400);

  const db = await getDb();
  const owner = await db
    .prepare(`SELECT id FROM "user" WHERE id = ? AND status != 'banned'`)
    .bind(input.ownerId)
    .first<{ id: string }>();
  if (!owner) throw new AuthError("User not found", 404);

  const id = createPublicId();
  const slug = await uniqueBusinessSlug(db, normalized.name, id);
  const shadow = moderation.shadow || input.ownerStatus === "shadowbanned" ? 1 : 0;
  const statements = [
    db
      .prepare(
        `INSERT INTO businesses (
           id, owner_id, slug, name, description, category, address, location,
           phone, website_url, latitude, longitude, opening_hours, is_shadow_hidden
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.ownerId,
        slug,
        normalized.name,
        normalized.description,
        normalized.category,
        normalized.address,
        normalized.location,
        normalized.phone,
        normalized.websiteUrl,
        normalized.latitude,
        normalized.longitude,
        normalized.openingHours,
        shadow
      ),
    ...normalized.services.map((service) =>
      db
        .prepare(
          `INSERT INTO business_services (
             id, business_id, name, description, price, duration_minutes
           ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          createPublicId(),
          id,
          service.name,
          service.description,
          service.price,
          service.durationMinutes
        )
    ),
  ];
  await db.batch(statements);
  return { id, slug };
}

export async function updateBusiness(input: {
  businessId: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  address: string;
  location: string;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  openingHours?: string | null;
  services?: ServiceInput[];
}) {
  const normalized = normalizeBusinessInput(input);
  const moderation = await moderateText(`${normalized.name}\n${normalized.description}`);
  if (moderation.blocked) throw new AuthError("This content isn't allowed", 400);
  const db = await getDb();
  const business = await db
    .prepare(`SELECT id, owner_id, status FROM businesses WHERE id = ?`)
    .bind(input.businessId)
    .first<{ id: string; owner_id: string; status: BusinessStatus }>();
  if (!business || business.status === "removed") {
    throw new AuthError("Business not found", 404);
  }
  if (business.owner_id !== input.ownerId) {
    throw new AuthError("Only the business owner can edit this profile", 403);
  }

  const statements = [
    db
      .prepare(
        `UPDATE businesses
         SET name = ?, description = ?, category = ?, address = ?, location = ?,
             phone = ?, website_url = ?, latitude = ?, longitude = ?, opening_hours = ?,
             updated_at = datetime('now')
         WHERE id = ? AND owner_id = ?`
      )
      .bind(
        normalized.name,
        normalized.description,
        normalized.category,
        normalized.address,
        normalized.location,
        normalized.phone,
        normalized.websiteUrl,
        normalized.latitude,
        normalized.longitude,
        normalized.openingHours,
        input.businessId,
        input.ownerId
      ),
    db
      .prepare(`DELETE FROM business_services WHERE business_id = ?`)
      .bind(input.businessId),
    ...normalized.services.map((service) =>
      db
        .prepare(
          `INSERT INTO business_services (
             id, business_id, name, description, price, duration_minutes
           ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          createPublicId(),
          input.businessId,
          service.name,
          service.description,
          service.price,
          service.durationMinutes
        )
    ),
  ];
  await db.batch(statements);
  const updated = await db
    .prepare(`SELECT slug FROM businesses WHERE id = ?`)
    .bind(input.businessId)
    .first<{ slug: string }>();
  return { id: input.businessId, slug: updated?.slug ?? input.businessId };
}

export async function updateBusinessStatus(input: {
  businessId: string;
  ownerId: string;
  status: string;
}) {
  if (!isBusinessStatus(input.status) || input.status === "removed") {
    throw new AuthError("Invalid business status", 400);
  }
  const db = await getDb();
  const business = await db
    .prepare(`SELECT owner_id, status FROM businesses WHERE id = ?`)
    .bind(input.businessId)
    .first<{ owner_id: string; status: BusinessStatus }>();
  if (!business || business.status === "removed") {
    throw new AuthError("Business not found", 404);
  }
  if (business.owner_id !== input.ownerId) {
    throw new AuthError("Only the business owner can update this profile", 403);
  }
  await db
    .prepare(
      `UPDATE businesses SET status = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(input.status, input.businessId)
    .run();
  return { status: input.status };
}

export async function submitBusinessVerification(input: {
  businessId: string;
  ownerId: string;
  evidence: string;
}) {
  const evidence = normalizeText(input.evidence, 2_000);
  if (evidence.length < 20) {
    throw new AuthError("Verification evidence must be 20–2000 characters", 400);
  }
  await enforceCreateRateLimit(input.ownerId, "business_verification");
  const db = await getDb();
  const business = await db
    .prepare(
      `SELECT owner_id, status, verification_status
       FROM businesses WHERE id = ?`
    )
    .bind(input.businessId)
    .first<{
      owner_id: string;
      status: BusinessStatus;
      verification_status: BusinessVerificationStatus;
    }>();
  if (!business || business.status === "removed") {
    throw new AuthError("Business not found", 404);
  }
  if (business.owner_id !== input.ownerId) {
    throw new AuthError("Only the business owner can request verification", 403);
  }
  if (business.verification_status === "verified") {
    throw new AuthError("This business is already verified", 409);
  }
  if (business.verification_status === "pending") {
    throw new AuthError("Verification is already under review", 409);
  }

  const requestId = createPublicId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO business_verification_requests
           (id, business_id, requester_id, evidence)
         VALUES (?, ?, ?, ?)`
      )
      .bind(requestId, input.businessId, input.ownerId, evidence),
    db
      .prepare(
        `UPDATE businesses
         SET verification_status = 'pending', updated_at = datetime('now')
         WHERE id = ? AND owner_id = ?`
      )
      .bind(input.businessId, input.ownerId),
  ]);
  return { id: requestId, status: "pending" as const };
}

export async function listBusinessVerificationQueue(
  status: "pending" | "approved" | "rejected" = "pending"
): Promise<BusinessVerificationQueueItem[]> {
  if (!isVerificationStatus(status)) {
    throw new AuthError("Invalid verification status", 400);
  }
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         r.id, r.business_id, b.slug AS business_slug, b.name AS business_name,
         b.category, b.location, u.username AS owner_username, u.name AS owner_name,
         r.evidence, r.status, r.created_at
       FROM business_verification_requests r
       INNER JOIN businesses b ON b.id = r.business_id
       INNER JOIN "user" u ON u.id = r.requester_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC, r.id ASC
       LIMIT 50`
    )
    .bind(status)
    .all<{
      id: string;
      business_id: string;
      business_slug: string;
      business_name: string;
      category: string;
      location: string;
      owner_username: string | null;
      owner_name: string;
      evidence: string;
      status: "pending" | "approved" | "rejected";
      created_at: string;
    }>();
  return (results ?? []).map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessSlug: row.business_slug,
    businessName: row.business_name,
    category: row.category,
    location: row.location,
    ownerUsername: row.owner_username,
    ownerName: row.owner_name,
    evidence: row.evidence,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function reviewBusinessVerification(input: {
  requestId: string;
  reviewerId: string;
  status: "approved" | "rejected";
  resolutionNote?: string | null;
}) {
  const note = normalizeText(input.resolutionNote, 500) || null;
  const db = await getDb();
  const request = await db
    .prepare(
      `SELECT id, business_id, status FROM business_verification_requests WHERE id = ?`
    )
    .bind(input.requestId)
    .first<{ id: string; business_id: string; status: string }>();
  if (!request) throw new AuthError("Verification request not found", 404);
  if (request.status !== "pending") {
    throw new AuthError("Verification request already handled", 409);
  }
  await db.batch([
    db
      .prepare(
        `UPDATE business_verification_requests
         SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), resolution_note = ?
         WHERE id = ? AND status = 'pending'`
      )
      .bind(input.status, input.reviewerId, note, input.requestId),
    db
      .prepare(
        `UPDATE businesses
         SET verification_status = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(input.status === "approved" ? "verified" : "rejected", request.business_id),
  ]);
  return {
    status: input.status,
    businessId: request.business_id,
  };
}

export async function createBusinessBooking(input: {
  businessId: string;
  requesterId: string;
  serviceId?: string | null;
  startAt: string;
  durationMinutes?: number;
  note?: string | null;
}) {
  const db = await getDb();
  const business = await db
    .prepare(
      `SELECT id, slug, name, owner_id, status, verification_status
       FROM businesses WHERE id = ? AND status = 'active' AND is_shadow_hidden = 0`
    )
    .bind(input.businessId)
    .first<{
      id: string;
      slug: string;
      name: string;
      owner_id: string;
      status: BusinessStatus;
      verification_status: BusinessVerificationStatus;
    }>();
  if (!business || business.verification_status !== "verified") {
    throw new AuthError("Only verified active businesses accept bookings", 403);
  }
  if (business.owner_id === input.requesterId) {
    throw new AuthError("You can't book your own business", 400);
  }

  let durationMinutes = Number(input.durationMinutes ?? 60);
  let serviceId: string | null = input.serviceId ?? null;
  if (serviceId) {
    const service = await db
      .prepare(
        `SELECT id, duration_minutes FROM business_services
         WHERE id = ? AND business_id = ? AND is_active = 1`
      )
      .bind(serviceId, input.businessId)
      .first<{ id: string; duration_minutes: number }>();
    if (!service) throw new AuthError("Service not found", 404);
    durationMinutes = Number(service.duration_minutes);
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    throw new AuthError("Booking duration must be 15–480 minutes", 400);
  }

  const parsed = new Date(input.startAt);
  if (!Number.isFinite(parsed.getTime())) {
    throw new AuthError("Choose a valid booking time", 400);
  }
  const startAt = parsed.toISOString();
  const now = Date.now();
  if (parsed.getTime() < now + 15 * 60_000) {
    throw new AuthError("Booking time must be at least 15 minutes from now", 400);
  }
  if (parsed.getTime() > now + 180 * 24 * 60 * 60_000) {
    throw new AuthError("Booking time must be within 180 days", 400);
  }
  const endAt = new Date(parsed.getTime() + durationMinutes * 60_000).toISOString();
  const note = normalizeText(input.note, 1_000) || null;

  await enforceCreateRateLimit(input.requesterId, "booking");
  const conflict = await db
    .prepare(
      `SELECT id FROM business_bookings
       WHERE business_id = ? AND status = 'confirmed'
         AND julianday(start_at) < julianday(?)
         AND julianday(start_at) + duration_minutes / 1440.0 > julianday(?)
       LIMIT 1`
    )
    .bind(input.businessId, endAt, startAt)
    .first<{ id: string }>();
  if (conflict) throw new AuthError("That time is already booked", 409);

  const id = createPublicId();
  try {
    await db
      .prepare(
        `INSERT INTO business_bookings (
           id, business_id, service_id, requester_id, start_at,
           duration_minutes, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.businessId,
        serviceId,
        input.requesterId,
        startAt,
        durationMinutes,
        note
      )
      .run();
  } catch {
    throw new AuthError("You already requested this time", 409);
  }
  return { id, businessSlug: business.slug, status: "requested" as const };
}

function mapBooking(row: {
  id: string;
  business_id: string;
  business_slug: string;
  business_name: string;
  service_id: string | null;
  service_name: string | null;
  requester_id: string;
  requester_username: string | null;
  requester_name: string;
  start_at: string;
  duration_minutes: number;
  note: string | null;
  status: BookingStatus;
  owner_note: string | null;
  created_at: string;
  is_owner: number;
}, viewerUserId: string): BusinessBooking {
  return {
    id: row.id,
    businessId: row.business_id,
    businessSlug: row.business_slug,
    businessName: row.business_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    requesterId: row.requester_id,
    requesterUsername: row.requester_username,
    requesterName: row.requester_name,
    startAt: row.start_at,
    durationMinutes: Number(row.duration_minutes),
    note: row.note,
    status: row.status,
    ownerNote: row.owner_note,
    createdAt: row.created_at,
    isOwner: Boolean(row.is_owner),
  };
}

export async function listBusinessBookings(input: {
  businessId: string;
  viewerUserId: string;
}) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         bk.id, bk.business_id, b.slug AS business_slug, b.name AS business_name,
         bk.service_id, bs.name AS service_name, bk.requester_id,
         requester.username AS requester_username, requester.name AS requester_name,
         bk.start_at, bk.duration_minutes, bk.note, bk.status, bk.owner_note,
         bk.created_at, (b.owner_id = ?) AS is_owner
       FROM business_bookings bk
       INNER JOIN businesses b ON b.id = bk.business_id
       LEFT JOIN business_services bs ON bs.id = bk.service_id
       INNER JOIN "user" requester ON requester.id = bk.requester_id
       WHERE bk.business_id = ?
         AND (b.owner_id = ? OR bk.requester_id = ?)
       ORDER BY bk.start_at ASC, bk.created_at DESC
       LIMIT 100`
    )
    .bind(input.viewerUserId, input.businessId, input.viewerUserId, input.viewerUserId)
    .all<{
      id: string;
      business_id: string;
      business_slug: string;
      business_name: string;
      service_id: string | null;
      service_name: string | null;
      requester_id: string;
      requester_username: string | null;
      requester_name: string;
      start_at: string;
      duration_minutes: number;
      note: string | null;
      status: BookingStatus;
      owner_note: string | null;
      created_at: string;
      is_owner: number;
    }>();
  return (results ?? []).map((row) => mapBooking(row, input.viewerUserId));
}

export async function updateBusinessBooking(input: {
  bookingId: string;
  viewerUserId: string;
  status: string;
  ownerNote?: string | null;
}) {
  if (!isBookingStatus(input.status)) {
    throw new AuthError("Invalid booking status", 400);
  }
  const db = await getDb();
  const booking = await db
    .prepare(
      `SELECT bk.id, bk.business_id, bk.requester_id, bk.start_at,
              bk.duration_minutes, bk.status, b.owner_id
       FROM business_bookings bk
       INNER JOIN businesses b ON b.id = bk.business_id
       WHERE bk.id = ?`
    )
    .bind(input.bookingId)
    .first<{
      id: string;
      business_id: string;
      requester_id: string;
      start_at: string;
      duration_minutes: number;
      status: BookingStatus;
      owner_id: string;
    }>();
  if (!booking) throw new AuthError("Booking not found", 404);

  const isOwner = booking.owner_id === input.viewerUserId;
  const isRequester = booking.requester_id === input.viewerUserId;
  if (input.status === "cancelled") {
    if (!isRequester || !["requested", "confirmed"].includes(booking.status)) {
      throw new AuthError("You can't cancel this booking", 403);
    }
  } else {
    if (!isOwner) throw new AuthError("Only the business owner can manage bookings", 403);
    const allowed =
      (input.status === "confirmed" && booking.status === "requested") ||
      (input.status === "declined" && booking.status === "requested") ||
      (input.status === "completed" && booking.status === "confirmed");
    if (!allowed) throw new AuthError("That booking transition is not allowed", 409);
  }

  if (input.status === "confirmed") {
    const endAt = new Date(
      new Date(booking.start_at).getTime() + Number(booking.duration_minutes) * 60_000
    ).toISOString();
    const conflict = await db
      .prepare(
        `SELECT id FROM business_bookings
         WHERE business_id = ? AND status = 'confirmed' AND id != ?
           AND julianday(start_at) < julianday(?)
           AND julianday(start_at) + duration_minutes / 1440.0 > julianday(?)
         LIMIT 1`
      )
      .bind(booking.business_id, booking.id, endAt, booking.start_at)
      .first<{ id: string }>();
    if (conflict) throw new AuthError("That time is already booked", 409);
  }

  const ownerNote = isOwner ? normalizeText(input.ownerNote, 1_000) || null : null;
  await db
    .prepare(
      `UPDATE business_bookings
       SET status = ?, owner_note = CASE WHEN ? = 1 THEN ? ELSE owner_note END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(input.status, isOwner ? 1 : 0, ownerNote, input.bookingId)
    .run();
  return { id: input.bookingId, status: input.status as BookingStatus };
}

export function serializeBusinessSummary(business: BusinessSummary) {
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    description: business.description,
    category: business.category,
    address: business.address,
    location: business.location,
    phone: business.phone,
    websiteUrl: business.websiteUrl,
    latitude: business.latitude,
    longitude: business.longitude,
    openingHours: business.openingHours,
    status: business.status,
    verificationStatus: business.verificationStatus,
    serviceCount: business.serviceCount,
    createdAt: business.createdAt,
    owner: business.owner,
  };
}

export function serializeBusinessDetail(business: BusinessDetail) {
  return {
    ...serializeBusinessSummary(business),
    services: business.services,
    latestVerification: business.latestVerification,
  };
}

export function serializeBusinessBooking(booking: BusinessBooking) {
  return booking;
}
