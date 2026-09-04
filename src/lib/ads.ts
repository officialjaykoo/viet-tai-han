import { getDb } from "@/lib/db";
import { getMonetizationContext } from "@/lib/monetization";
import { AuthError } from "@/lib/session";
import {
  CacheKeys,
  cacheDeletePrefix,
  cacheGetJson,
  cacheSetJson,
} from "@/lib/cache";
import { getSiteSetting } from "@/lib/settings";
import { sha256Hex } from "@/lib/security/crypto";
import type { FeedAdItem, FeedItem, FeedPost } from "@/lib/types";

export type AdPlacement = "feed_inline" | "sidebar" | "post_footer";
export type AdStatus = "draft" | "active" | "paused" | "ended";

export type AdCampaign = {
  id: string;
  name: string;
  status: AdStatus;
  placement: AdPlacement;
  body: string | null;
  imageKey: string | null;
  targetUrl: string;
  weight: number;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  impressions?: number;
  clicks?: number;
};

function mapCampaign(row: Record<string, unknown>): AdCampaign {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as AdStatus,
    placement: row.placement as AdPlacement,
    body: (row.body as string | null) ?? null,
    imageKey: (row.image_key as string | null) ?? null,
    targetUrl: String(row.target_url),
    weight: Number(row.weight ?? 1),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    impressions: row.impressions != null ? Number(row.impressions) : undefined,
    clicks: row.clicks != null ? Number(row.clicks) : undefined,
  };
}
const AD_PLACEMENTS = ["feed_inline", "sidebar", "post_footer"] as const;
const AD_STATUSES = ["draft", "active", "paused", "ended"] as const;

export function isAdPlacement(value: unknown): value is AdPlacement {
  return (
    typeof value === "string" &&
    (AD_PLACEMENTS as readonly string[]).includes(value)
  );
}

export function isAdStatus(value: unknown): value is AdStatus {
  return (
    typeof value === "string" &&
    (AD_STATUSES as readonly string[]).includes(value)
  );
}

function normalizeTargetUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("Invalid target URL", 400);
  }
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("scheme");
    return url.toString();
  } catch {
    throw new AuthError("Invalid target URL", 400);
  }

}
export async function listAdCampaigns(): Promise<AdCampaign[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM ad_impressions i WHERE i.campaign_id = c.id) AS impressions,
         (SELECT COUNT(*) FROM ad_clicks k WHERE k.campaign_id = c.id) AS clicks
       FROM ad_campaigns c
       ORDER BY c.created_at DESC
       LIMIT 100`
    )
    .all();
  return (results ?? []).map((row) =>
    mapCampaign(row as Record<string, unknown>)
  );
}

export async function createAdCampaign(input: {
  name: string;
  placement: AdPlacement;
  targetUrl: string;
  body?: string | null;
  imageKey?: string | null;
  weight?: number;
  status?: AdStatus;
  createdBy: string;
}) {
  if (typeof input.name !== "string") {
    throw new AuthError("Name required", 400);
  }
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new AuthError("Name required", 400);
  }
  if (!isAdPlacement(input.placement)) {
    throw new AuthError("Invalid ad placement", 400);
  }
  const status = input.status ?? "draft";
  if (!isAdStatus(status)) {
    throw new AuthError("Invalid ad status", 400);
  }
  const weight = input.weight ?? 1;
  if (!Number.isSafeInteger(weight) || weight < 1 || weight > 1000) {
    throw new AuthError("Invalid ad weight", 400);
  }
  if (input.body != null && typeof input.body !== "string") {
    throw new AuthError("Ad copy is invalid", 400);
  }
  if (input.body != null && input.body.length > 2000) {
    throw new AuthError("Ad copy is too long", 400);
  }
  const targetUrl = normalizeTargetUrl(input.targetUrl);

  const id = crypto.randomUUID();
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO ad_campaigns (
         id, name, status, placement, body, image_key, target_url, weight, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      name,
      status,
      input.placement,
      input.body?.trim() || null,
      input.imageKey ?? null,
      targetUrl,
      weight,
      input.createdBy
    )
    .run();
  await cacheDeletePrefix("ads:");
  return id;
}

export async function updateAdCampaign(input: {
  id: string;
  status?: AdStatus;
  name?: string;
  weight?: number;
  body?: string | null;
  targetUrl?: string;
}) {
  const db = await getDb();
  const existing = await db
    .prepare(`SELECT id FROM ad_campaigns WHERE id = ?`)
    .bind(input.id)
    .first();
  if (!existing) throw new AuthError("Campaign not found", 404);

  if (input.status !== undefined) {
    if (!isAdStatus(input.status)) {
      throw new AuthError("Invalid ad status", 400);
    }
    await db
      .prepare(
        `UPDATE ad_campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.status, input.id)
      .run();
  }
  if (input.name !== undefined) {
    if (typeof input.name !== "string") {
      throw new AuthError("Name required", 400);
    }
    const name = input.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new AuthError("Name required", 400);
    }
    await db
      .prepare(
        `UPDATE ad_campaigns SET name = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(name, input.id)
      .run();
  }
  if (input.weight !== undefined) {
    if (
      !Number.isSafeInteger(input.weight) ||
      input.weight < 1 ||
      input.weight > 1000
    ) {
      throw new AuthError("Invalid ad weight", 400);
    }
    await db
      .prepare(
        `UPDATE ad_campaigns SET weight = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.weight, input.id)
      .run();
  }
  if (input.body !== undefined) {
    if (input.body != null && typeof input.body !== "string") {
      throw new AuthError("Ad copy is invalid", 400);
    }
    if (input.body != null && input.body.length > 2000) {
      throw new AuthError("Ad copy is too long", 400);
    }
    await db
      .prepare(
        `UPDATE ad_campaigns SET body = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.body?.trim() || null, input.id)
      .run();
  }
  if (input.targetUrl !== undefined) {
    await db
      .prepare(
        `UPDATE ad_campaigns SET target_url = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(normalizeTargetUrl(input.targetUrl), input.id)
      .run();
  }
  await cacheDeletePrefix("ads:");
}

/** Weighted random pick among active campaigns for a placement. */
export async function pickAdForPlacement(
  placement: AdPlacement
): Promise<AdCampaign | null> {
  if ((await getSiteSetting("ads_enabled", "0")) !== "1") return null;
  const cacheKey = CacheKeys.adPlacement(placement);
  let campaigns = await cacheGetJson<AdCampaign[]>(cacheKey);

  if (!campaigns) {
    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT * FROM ad_campaigns
         WHERE status = 'active'
           AND placement = ?
           AND (starts_at IS NULL OR starts_at <= datetime('now'))
           AND (ends_at IS NULL OR ends_at >= datetime('now'))`
      )
      .bind(placement)
      .all();

    campaigns = (results ?? []).map((row) =>
      mapCampaign(row as Record<string, unknown>)
    );
    await cacheSetJson(cacheKey, campaigns, 60);
  }

  if (campaigns.length === 0) return null;

  const total = campaigns.reduce((sum, campaign) => sum + campaign.weight, 0);
  let random = Math.random() * total;
  for (const campaign of campaigns) {
    random -= campaign.weight;
    if (random <= 0) return campaign;
  }
  return campaigns[campaigns.length - 1] ?? null;
}

/** How often to insert a feed_inline ad among organic posts. */
export const FEED_AD_EVERY_N = 5;

export function campaignToFeedAd(
  campaign: AdCampaign,
  slotKey: string
): FeedAdItem {
  return {
    kind: "ad",
    id: `ad_${campaign.id}_${slotKey}`,
    campaignId: campaign.id,
    title: campaign.name,
    body: campaign.body,
    mediaKey: campaign.imageKey,
    clickUrl: `/api/ads/${campaign.id}/click`,
    placement: campaign.placement,
    createdAt: campaign.createdAt,
  };
}

/**
 * Weave sponsored items into an organic post page.
 * Cursor pagination stays post-only — ads are decoration for this page.
 * Impressions are recorded server-side so clients need no /api/ads fetch.
 */
export async function injectAdsIntoFeed(
  posts: FeedPost[],
  options?: {
    every?: number;
    placement?: AdPlacement;
    viewerId?: string | null;
    recordImpressions?: boolean;
  }
): Promise<FeedItem[]> {
  const every = options?.every ?? FEED_AD_EVERY_N;
  const placement = options?.placement ?? "feed_inline";
  const recordImpressions =
    options?.recordImpressions === true && Boolean(options?.viewerId);

  if (posts.length === 0) return [];

  const out: FeedItem[] = [];
  let slot = 0;

  for (let i = 0; i < posts.length; i++) {
    out.push({ kind: "post", ...posts[i]! });
    if ((i + 1) % every === 0) {
      try {
        const campaign = await pickAdForPlacement(placement);
        if (!campaign) continue;
        const ad = campaignToFeedAd(campaign, `${slot++}`);
        out.push(ad);
        if (recordImpressions) {
          void recordAdImpression({
            campaignId: campaign.id,
            viewerId: options?.viewerId ?? null,
            placement,
          }).catch(() => {
            // best-effort
          });
        }
      } catch {
        // Ads must never break the feed
      }
    }
  }

  return out;
}

export async function withFeedAds(
  feed: {
    posts: FeedPost[];
    nextCursor: string | null;
    hasMore: boolean;
  },
  viewerId?: string | null
): Promise<{
  posts: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  try {
    const monetization = await getMonetizationContext(viewerId ?? null);
    if (monetization.isPro) {
      return {
        posts: feed.posts.map((post) => ({ kind: "post", ...post })),
        nextCursor: feed.nextCursor,
        hasMore: feed.hasMore,
      };
    }
    return {
      posts: await injectAdsIntoFeed(feed.posts, {
        viewerId,
        recordImpressions: monetization.analyticsAllowed,
      }),
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
    };
  } catch {
    // Monetization failures must never break the organic feed.
    return {
      posts: feed.posts.map((post) => ({ kind: "post", ...post })),
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
    };
  }
}

export async function recordAdImpression(input: {
  campaignId: string;
  viewerId?: string | null;
  placement: string;
}): Promise<boolean> {
  if (!input.viewerId || !isAdPlacement(input.placement)) return false;
  if ((await getSiteSetting("ads_enabled", "0")) !== "1") return false;
  const monetization = await getMonetizationContext(input.viewerId);
  if (!monetization.analyticsAllowed || monetization.isPro) return false;

  const db = await getDb();
  const campaign = await db
    .prepare(
      `SELECT id FROM ad_campaigns
       WHERE id = ? AND placement = ? AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at IS NULL OR ends_at >= datetime('now'))`
    )
    .bind(input.campaignId, input.placement)
    .first<{ id: string }>();
  if (!campaign) return false;

  const day = new Date().toISOString().slice(0, 10);
  const dedupeKey = await sha256Hex(
    `ad-impression:${input.campaignId}:${input.viewerId}:${input.placement}:${day}`
  );
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO ad_impressions (
         id, campaign_id, viewer_id, placement, dedupe_key
       ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.campaignId,
      input.viewerId,
      input.placement,
      dedupeKey
    )
    .run();
  return Number(result.meta?.changes ?? 0) > 0;
}

export async function recordAdClick(input: {
  campaignId: string;
  viewerId?: string | null;
}): Promise<string | null> {
  if ((await getSiteSetting("ads_enabled", "0")) !== "1") return null;
  const db = await getDb();
  const campaign = await db
    .prepare(
      `SELECT target_url FROM ad_campaigns
       WHERE id = ? AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at IS NULL OR ends_at >= datetime('now'))`
    )
    .bind(input.campaignId)
    .first<{ target_url: string }>();
  if (!campaign) return null;

  if (input.viewerId) {
    const monetization = await getMonetizationContext(input.viewerId);
    if (monetization.analyticsAllowed && !monetization.isPro) {
      await db
        .prepare(
          `INSERT INTO ad_clicks (id, campaign_id, viewer_id) VALUES (?, ?, ?)`
        )
        .bind(crypto.randomUUID(), input.campaignId, input.viewerId)
        .run();
    }
  }

  return campaign.target_url;
}

export async function getAdCampaignStats(campaignId: string) {
  const db = await getDb();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM ad_impressions WHERE campaign_id = ?) AS impressions_all,
         (SELECT COUNT(*) FROM ad_clicks WHERE campaign_id = ?) AS clicks_all,
         (SELECT COUNT(*) FROM ad_impressions WHERE campaign_id = ? AND created_at >= ?) AS impressions_24h,
         (SELECT COUNT(*) FROM ad_clicks WHERE campaign_id = ? AND created_at >= ?) AS clicks_24h,
         (SELECT COUNT(*) FROM ad_impressions WHERE campaign_id = ? AND created_at >= ?) AS impressions_7d,
         (SELECT COUNT(*) FROM ad_clicks WHERE campaign_id = ? AND created_at >= ?) AS clicks_7d`
    )
    .bind(
      campaignId,
      campaignId,
      campaignId,
      dayAgo,
      campaignId,
      dayAgo,
      campaignId,
      weekAgo,
      campaignId,
      weekAgo
    )
    .first<{
      impressions_all: number;
      clicks_all: number;
      impressions_24h: number;
      clicks_24h: number;
      impressions_7d: number;
      clicks_7d: number;
    }>();

  function ctr(clicks: number, impressions: number) {
    if (!impressions) return 0;
    return Math.round((clicks / impressions) * 10000) / 100;
  }

  return {
    all: {
      impressions: Number(counts?.impressions_all ?? 0),
      clicks: Number(counts?.clicks_all ?? 0),
      ctr: ctr(
        Number(counts?.clicks_all ?? 0),
        Number(counts?.impressions_all ?? 0)
      ),
    },
    last24h: {
      impressions: Number(counts?.impressions_24h ?? 0),
      clicks: Number(counts?.clicks_24h ?? 0),
      ctr: ctr(
        Number(counts?.clicks_24h ?? 0),
        Number(counts?.impressions_24h ?? 0)
      ),
    },
    last7d: {
      impressions: Number(counts?.impressions_7d ?? 0),
      clicks: Number(counts?.clicks_7d ?? 0),
      ctr: ctr(
        Number(counts?.clicks_7d ?? 0),
        Number(counts?.impressions_7d ?? 0)
      ),
    },
  };
}
