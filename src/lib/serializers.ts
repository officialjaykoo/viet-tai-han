import type { CommentNode, PostDetail } from "@/lib/content";
import type { AccountTag } from "@/lib/tags";
import type {
  FeedAdItem,
  FeedItem,
  FeedPost,
  PaginatedFeed,
  ViewerVote,
} from "@/lib/types";

/** Public author — no internal user UUID. */
export type PublicAuthor = {
  username: string;
  displayName: string | null;
  image: string | null;
  tags: AccountTag[];
  isAuthor: boolean;
};

export type PublicFeedPost = Omit<FeedPost, "author"> & {
  kind: "post";
  author: PublicAuthor;
};

export type PublicFeedAd = FeedAdItem;

export type PublicFeedItem = PublicFeedPost | PublicFeedAd;

export type PublicComment = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  score: number;
  depth: number;
  createdAt: string;
  isDeleted: boolean;
  viewerVote: ViewerVote;
  translation: FeedPost["translation"];
  author: PublicAuthor;
  children: PublicComment[];
};

export type PublicPostDetail = PublicFeedPost & {
  isLocked: boolean;
  comments: PublicComment[];
};

export type PublicVoteResult = {
  postId: string;
  score: number;
  viewerVote: ViewerVote;
};

export type PublicCommentVoteResult = {
  commentId: string;
  score: number;
  viewerVote: ViewerVote;
};

function publicAuthor(
  author: {
    id?: string | null;
    username: string | null;
    displayName: string | null;
    image: string | null;
    tags: AccountTag[];
    isAuthor?: boolean;
  },
  viewerUserId?: string | null
): PublicAuthor {
  return {
    username: author.username ?? "unknown",
    displayName: author.displayName,
    image: author.image,
    tags: author.tags ?? [],
    isAuthor:
      author.isAuthor ??
      Boolean(viewerUserId && author.id && viewerUserId === author.id),
  };
}

export function serializeFeedPost(
  post: FeedPost,
  viewerUserId?: string | null
): PublicFeedPost {
  return {
    kind: "post",
    id: post.id,
    title: post.title,
    body: post.body,
    url: post.url,
    mediaKey: post.mediaKey,
    score: post.score,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    viewerVote: post.viewerVote,
    translation: post.translation,
    author: publicAuthor(post.author, viewerUserId),
    subreddit: {
      id: post.subreddit.id,
      name: post.subreddit.name,
      title: post.subreddit.title,
    },
  };
}

export function serializeFeedItem(
  item: FeedItem,
  viewerUserId?: string | null
): PublicFeedItem {
  if (item.kind === "ad") return item;
  return serializeFeedPost(item, viewerUserId);
}

export function serializeFeed(
  feed: PaginatedFeed,
  viewerUserId?: string | null
): {
  posts: PublicFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  return {
    posts: feed.posts.map((item) => serializeFeedItem(item, viewerUserId)),
    nextCursor: feed.nextCursor,
    hasMore: feed.hasMore,
  };
}

export function serializeComment(
  comment: CommentNode,
  viewerUserId?: string | null
): PublicComment {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    body: comment.body,
    score: comment.score,
    depth: comment.depth,
    createdAt: comment.createdAt,
    isDeleted: comment.isDeleted,
    viewerVote: comment.viewerVote,
    translation: comment.translation,
    author: publicAuthor(
      {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.displayName,
        image: comment.author.image,
        tags: comment.author.tags,
      },
      viewerUserId
    ),
    children: comment.children.map((child) =>
      serializeComment(child, viewerUserId)
    ),
  };
}

export function serializePostDetail(
  post: PostDetail,
  viewerUserId?: string | null
): PublicPostDetail {
  return {
    ...serializeFeedPost(post, viewerUserId),
    isLocked: post.isLocked,
    comments: post.comments.map((comment) =>
      serializeComment(comment, viewerUserId)
    ),
  };
}

export function serializeVoteResult(result: {
  postId: string;
  score: number;
  viewerVote: ViewerVote;
}): PublicVoteResult {
  return {
    postId: result.postId,
    score: result.score,
    viewerVote: result.viewerVote,
  };
}

export function serializeCommentVoteResult(result: {
  commentId: string;
  score: number;
  viewerVote: ViewerVote;
}): PublicCommentVoteResult {
  return {
    commentId: result.commentId,
    score: result.score,
    viewerVote: result.viewerVote,
  };
}

/** Community payload without creator UUID. */
export function serializeCommunity(sub: {
  id: string;
  name: string;
  title: string;
  description: string | null;
  subscriberCount?: number;
  subscriber_count?: number;
  createdAt?: string;
  created_at?: string;
}) {
  return {
    id: sub.id,
    name: sub.name,
    title: sub.title,
    description: sub.description,
    subscriberCount: sub.subscriberCount ?? sub.subscriber_count ?? 0,
    createdAt: sub.createdAt ?? sub.created_at ?? null,
  };
}
