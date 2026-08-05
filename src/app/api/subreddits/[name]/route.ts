import { NextResponse } from "next/server";

import { getSubredditByName } from "@/lib/content";
import { withFeedAds } from "@/lib/ads";
import { getFeedPosts } from "@/lib/db";
import { serializeCommunity, serializeFeed } from "@/lib/serializers";
import { getSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;
    const sub = await getSubredditByName(name);
    if (!sub || sub.is_removed) {
      return await jsonLocalizedError("Not found", 404);
    }

    const session = await getSession();
    const viewerUserId = session?.user?.id ?? null;
    const feed = await getFeedPosts({
      subreddit: sub.name,
      limit: 20,
      viewerUserId,
    });
    const withAds = await withFeedAds(feed, viewerUserId);

    return NextResponse.json({
      community: serializeCommunity({
        id: sub.id,
        name: sub.name,
        title: sub.title,
        description: sub.description,
        subscriber_count: sub.subscriber_count,
        created_at: sub.created_at,
      }),
      feed: serializeFeed(withAds, viewerUserId),
    });
  } catch (error) {
    console.error("GET /api/subreddits/[name] failed", error);
    return await jsonLocalizedError("Failed to load community", 500);
  }
}
