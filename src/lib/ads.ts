import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";
import {
  CacheKeys,
  cacheDeletePrefix,
  cacheGetJson,
  cacheSetJson,
} from "@/lib/cache";
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
  const name = input.name.trim();
  if (name.length < 2) throw new AuthError("Name required", 400);
  let targetUrl: string;
  try {
    const u = new URL(input.targetUrl.trim());
    if (!["http:", "https:"].includes(u.protocol)) {
      throw new Error("bad");
    }
    targetUrl = u.toString();
  } catch {
    throw new AuthError("Invalid target URL", 400);
  }

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
      input.status ?? "draft",
      input.placement,
      input.body?.trim() || null,
      input.imageKey ?? null,
      targetUrl,
      Math.max(1, input.weight ?? 1),
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

  if (input.status) {
    await db
      .prepare(
        `UPDATE ad_campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.status, input.id)
      .run();
  }
  if (input.name != null) {
    await db
      .prepare(
        `UPDATE ad_campaigns SET name = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.name.trim(), input.id)
      .run();
  }
  if (input.weight != null) {
    await db
      .prepare(
        `UPDATE ad_campaigns SET weight = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(Math.max(1, input.weight), input.id)
      .run();
  }
  if (input.body !== undefined) {
    await db
      .prepare(
        `UPDATE ad_campaigns SET body = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.body?.trim() || null, input.id)
      .run();
  }
  if (input.targetUrl) {
    const u = new URL(input.targetUrl.trim());
    await db
      .prepare(
        `UPDATE ad_campaigns SET target_url = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(u.toString(), input.id)
      .run();
  }
  await cacheDeletePrefix("ads:");
}

/** Weighted random pick among active campaigns for a placement. */
export async function pickAdForPlacement(
  placement: AdPlacement
): Promise<AdCampaign | null> {
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

  const total = campaigns.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of campaigns) {
    r -= c.weight;
    if (r <= 0) return c;
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
  const recordImpressions = options?.recordImpressions !== false;

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
  return {
    posts: await injectAdsIntoFeed(feed.posts, { viewerId }),
    nextCursor: feed.nextCursor,
    hasMore: feed.hasMore,
  };
}

export async function recordAdImpression(input: {
  campaignId: string;
  viewerId?: string | null;
  placement: string;
}) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO ad_impressions (id, campaign_id, viewer_id, placement)
       VALUES (?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.campaignId,
      input.viewerId ?? null,
      input.placement
    )
    .run();
}

export async function recordAdClick(input: {
  campaignId: string;
  viewerId?: string | null;
}): Promise<string | null> {
  const db = await getDb();
  const campaign = await db
    .prepare(`SELECT target_url FROM ad_campaigns WHERE id = ?`)
    .bind(input.campaignId)
    .first<{ target_url: string }>();
  if (!campaign) return null;

  await db
    .prepare(
      `INSERT INTO ad_clicks (id, campaign_id, viewer_id) VALUES (?, ?, ?)`
    )
    .bind(crypto.randomUUID(), input.campaignId, input.viewerId ?? null)
    .run();

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
