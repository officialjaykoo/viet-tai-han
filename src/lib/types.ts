import type { AccountTag } from "@/lib/tags";

export type LikeMutation = "like" | "unlike";
export type ViewerLike = boolean;

export interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  karma: number;
  created_at: string;
}

export interface SubredditRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  subscriber_count: number;
  created_at: string;
}

export interface PostRow {
  id: string;
  subreddit_id: string;
  author_id: string;
  title: string;
  body: string | null;
  url: string | null;
  media_key: string | null;
  like_count: number;
  comment_count: number;
  is_nsfw: number;
  is_locked: number;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  depth: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export type ContentTargetLang = "vi" | "ko";
export type ContentSourceLang = ContentTargetLang | "en" | "ru" | "other";
export type ContentTranslationStatus =
  | "pending"
  | "ready"
  | "skipped"
  | "failed";

export interface ContentTranslation {
  sourceLang: ContentSourceLang | null;
  targetLang: ContentTargetLang | null;
  status: ContentTranslationStatus;
  titleTranslated: string | null;
  bodyTranslated: string | null;
}

export interface FeedPost {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  mediaKey: string | null;
  commentCount: number;
  createdAt: string;
  likeCount: number;
  liked: ViewerLike;
  translation: ContentTranslation | null;
  author: {
    /** Internal only — omitted from public API serializers. */
    id?: string;
    username: string;
    displayName: string | null;
    image: string | null;
    tags: AccountTag[];
    isAuthor: boolean;
  };
  subreddit: {
    id: string;
    name: string;
    title: string;
  };
}

/** Sponsored item embedded in the feed response (not a separate ad fetch). */
export interface FeedAdItem {
  kind: "ad";
  id: string;
  campaignId: string;
  title: string;
  body: string | null;
  mediaKey: string | null;
  clickUrl: string;
  placement: "feed_inline" | "sidebar" | "post_footer";
  createdAt: string;
}

export type FeedItem = (FeedPost & { kind: "post" }) | FeedAdItem;

/** Organic posts only (before ad injection). */
export interface OrganicFeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedFeed {
  posts: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LikeResult {
  postId: string;
  likeCount: number;
  liked: boolean;
}

export interface CommentLikeResult {
  commentId: string;
  likeCount: number;
  liked: boolean;
}

export interface ChatMessage {
  id: string;
  clientMessageId: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
  senderUsername: string | null;
}

export interface ChatHistoryPage {
  messages: ChatMessage[];
  hasMoreBefore: boolean;
  nextBeforeCursor: string | null;
  hasMoreAfter: boolean;
  nextAfterCursor: string | null;
}
