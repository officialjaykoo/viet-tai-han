import type {
  ContentSourceLang,
  ContentTranslation,
  ContentTranslationStatus,
  FeedPost,
} from "@/lib/types";
import { resolveAccountTags } from "@/lib/tags";

export type PostProjectionRow = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  media_key: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  source_lang?: string | null;
  translation_target_lang?: string | null;
  title_translated?: string | null;
  body_translated?: string | null;
  translation_status?: string | null;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  author_image?: string | null;
  author_role?: string | null;
  author_is_nsfw?: number | null;
  author_created_at?: string | null;
  author_karma?: number | null;
  author_is_community_mod?: number | null;
  author_has_veteran?: number | null;
  subreddit_id: string;
  subreddit_name: string;
  subreddit_title: string;
  viewer_liked?: number | null;
};

export function mapPostTranslation(row: {
  source_lang?: string | null;
  translation_target_lang?: string | null;
  translation_status?: string | null;
  title_translated?: string | null;
  body_translated?: string | null;
}): ContentTranslation | null {
  const status = (row.translation_status ?? "pending") as ContentTranslationStatus;
  if (status !== "ready") {
    return {
      sourceLang: (row.source_lang as ContentSourceLang | null) ?? null,
      targetLang:
        (row.translation_target_lang as ContentTranslation["targetLang"]) ?? null,
      status,
      titleTranslated: null,
      bodyTranslated: null,
    };
  }
  return {
    sourceLang: (row.source_lang as ContentSourceLang | null) ?? null,
    targetLang:
      (row.translation_target_lang as ContentTranslation["targetLang"]) ?? null,
    status,
    titleTranslated: row.title_translated ?? null,
    bodyTranslated: row.body_translated ?? null,
  };
}

/** Shared public post DTO used by feed, discovery, recommendations, and detail. */
export function mapPostProjection(
  row: PostProjectionRow,
  viewerUserId?: string | null
): FeedPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    mediaKey: row.media_key,
    commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at,
    likeCount: Number(row.like_count ?? 0),
    liked: Boolean(row.viewer_liked),
    translation: mapPostTranslation(row),
    author: {
      id: row.author_id,
      username: row.author_username ?? "unknown",
      displayName: row.author_display_name,
      image: row.author_image ?? null,
      tags: resolveAccountTags({
        role: row.author_role,
        isNsfw: row.author_is_nsfw,
        createdAt: row.author_created_at,
        karma: row.author_karma,
        isCommunityMod: Boolean(row.author_is_community_mod),
        hasVeteranAchievement: Boolean(row.author_has_veteran),
      }),
      isAuthor: Boolean(viewerUserId && viewerUserId === row.author_id),
    },
    subreddit: {
      id: row.subreddit_id,
      name: row.subreddit_name,
      title: row.subreddit_title,
    },
  };
}
