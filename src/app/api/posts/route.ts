import { NextRequest, NextResponse } from "next/server";

import { createPost } from "@/lib/actions";
import { withFeedAds } from "@/lib/ads";
import {
  getDb,
  getFeedPosts,
  InvalidFeedCursorError,
  type FeedMode,
  type FeedSort,
} from "@/lib/db";
import { serializeFeed } from "@/lib/serializers";
import {
  getSession,
  AuthError,
  jsonAuthError,
  requireSession,
} from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";
import { requireBotAttestation } from "@/lib/security/bot-guard";
import { requireActiveUser } from "@/lib/permissions";

const SORTS = new Set<FeedSort>(["hot", "new", "top"]);
const MODES = new Set<FeedMode>(["home", "popular", "community"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const cursor = searchParams.get("cursor");
    const subreddit = searchParams.get("subreddit");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const sortParam = searchParams.get("sort") ?? "hot";
    const modeParam = searchParams.get("feed") ?? (subreddit ? "community" : "popular");

    if (limitParam && Number.isNaN(limit)) {
      return await jsonLocalizedError("Invalid limit", 400);
    }
    if (!SORTS.has(sortParam as FeedSort)) {
      return await jsonLocalizedError("Invalid sort", 400);
    }
    if (!MODES.has(modeParam as FeedMode)) {
      return await jsonLocalizedError("Invalid feed mode", 400);
    }

    const session = await getSession();
    const viewerUserId = session?.user?.id ?? null;
    const feed = await getFeedPosts({
      cursor,
      subreddit,
      limit,
      viewerUserId,
      sort: sortParam as FeedSort,
      mode: modeParam as FeedMode,
    });
    const withAds = await withFeedAds(feed, viewerUserId);

    return NextResponse.json(serializeFeed(withAds, viewerUserId), {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof InvalidFeedCursorError) {
      return await jsonLocalizedError("Invalid cursor", 400);
    }
    console.error("GET /api/posts failed", error);
    return await jsonLocalizedError("Failed to load feed", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = requireBotAttestation(await readApiJson(request)) as {
      subreddit?: string;
      title?: string;
      body?: string;
      url?: string;
      mediaKey?: string;
    };

    if (!body.subreddit || !body.title) {
      return await jsonLocalizedError("subreddit and title are required", 400);
    }

    const user = session.user as {
      id: string;
      status?: string | null;
      username?: string | null;
      name?: string | null;
    };

    await requireActiveUser(user);

    let subredditId: string;

    if (body.subreddit === "profile" || body.subreddit === "@me") {
      const username = user.username ?? user.name;
      if (!username) {
        return await jsonLocalizedError("Set a username before posting to your profile", 400);
      }
      const { ensureProfileCommunity } = await import(
        "@/lib/profile-community"
      );
      const profile = await ensureProfileCommunity({
        userId: user.id,
        username,
      });
      subredditId = profile.id;
    } else {
      const db = await getDb();
      const sub = await db
        .prepare(
          `SELECT id FROM subreddits WHERE name = ? COLLATE NOCASE AND is_removed = 0`
        )
        .bind(body.subreddit)
        .first<{ id: string }>();

      if (!sub) {
        return await jsonLocalizedError("Community not found", 404);
      }
      subredditId = sub.id;
    }

    const result = await createPost({
      userId: user.id,
      userStatus: user.status,
      subredditId,
      title: body.title,
      body: body.body,
      url: body.url,
      mediaKey: body.mediaKey,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/posts failed", error);
    return await jsonLocalizedError("Failed to create post", 500);
  }
}
