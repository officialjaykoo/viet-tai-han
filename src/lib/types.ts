import type { AccountTag } from "@/lib/tags";

export type VoteAction = "upvote" | "downvote";

/** Current viewer's vote on a target, if any. */
export type ViewerVote = VoteAction | null;

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
  upvotes: number;
  downvotes: number;
  score: number;
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
  upvotes: number;
  downvotes: number;
  score: number;
  depth: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export type ContentSourceLang = "en" | "ru" | "other";
export type ContentTranslationStatus =
  | "pending"
  | "ready"
  | "skipped"
  | "failed";

export interface ContentTranslation {
  sourceLang: ContentSourceLang | null;
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
  score: number;
  commentCount: number;
  createdAt: string;
  viewerVote: ViewerVote;
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

/** Client-facing vote payload — score only (no upvote/downvote breakdown). */
export interface VoteResult {
  postId: string;
  score: number;
  viewerVote: ViewerVote;
}

/** Durable Object internal vote snapshot (not returned by public APIs). */
export interface InternalVoteResult {
  postId: string;
  upvotes: number;
  downvotes: number;
  score: number;
  viewerVote: ViewerVote;
  pendingFlush: boolean;
  alreadyVoted: boolean;
}

export interface CommentVoteResult {
  commentId: string;
  score: number;
  viewerVote: ViewerVote;
}
