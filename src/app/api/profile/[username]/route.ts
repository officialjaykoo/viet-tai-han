import { NextRequest, NextResponse } from "next/server";

import {
  listUserCommentsPage,
  resolvePublicProfile,
} from "@/lib/content";
import { getFeedPosts } from "@/lib/db";
import { jsonLocalizedError } from "@/lib/public-error";
import { InvalidFeedCursorError } from "@/lib/security/feed-cursor";
import { getProfileRelation } from "@/lib/user-actions";
import { getSession } from "@/lib/session";
import { serializeFeed } from "@/lib/serializers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await context.params;
    const lookup = await resolvePublicProfile(username);
    if (!lookup || lookup.profile.status === "banned") {
      return await jsonLocalizedError("User not found", 404);
    }
    if (lookup.redirectUsername) {
      return NextResponse.json(
        { redirectUsername: lookup.redirectUsername },
        { status: 409 }
      );
    }

    const tab = request.nextUrl.searchParams.get("tab") ?? "posts";
    if (tab !== "posts" && tab !== "comments") {
      return await jsonLocalizedError("Invalid profile tab", 400);
    }
    const cursor = request.nextUrl.searchParams.get("cursor");
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit === null ? 30 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return await jsonLocalizedError("Invalid limit", 400);
    }

    const session = await getSession();
    const relation = await getProfileRelation(
      session?.user?.id,
      lookup.profile.id
    );
    if (!relation.canViewProfile) {
      return await jsonLocalizedError("User not found", 404);
    }
    if (tab === "comments") {
      return NextResponse.json(
        await listUserCommentsPage(lookup.profile.id, { cursor, limit })
      );
    }

    const feed = await getFeedPosts({
      authorId: lookup.profile.id,
      cursor,
      limit,
      sort: "new",
      mode: "popular",
      viewerUserId: session?.user?.id ?? null,
    });
    const serialized = serializeFeed(
      {
        posts: feed.posts.map((post) => ({ ...post, kind: "post" as const })),
        nextCursor: feed.nextCursor,
        hasMore: feed.hasMore,
      },
      session?.user?.id ?? null
    );
    return NextResponse.json({
      posts: serialized.posts.filter((post) => post.kind === "post"),
      nextCursor: serialized.nextCursor,
      hasMore: serialized.hasMore,
    });
  } catch (error) {
    if (error instanceof InvalidFeedCursorError) {
      return await jsonLocalizedError("Invalid cursor", 400);
    }
    console.error("GET /api/profile/[username] failed", error);
    return await jsonLocalizedError("Failed to load profile activity", 500);
  }
}
