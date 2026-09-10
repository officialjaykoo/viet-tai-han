import type { CommentNode, PostDetail } from "@/lib/content";
import type { AccountTag } from "@/lib/tags";
import type {
  FeedItem,
  FeedPost,
  PaginatedFeed,
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
export type PublicFeedItem = PublicFeedPost;


export type PublicComment = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  likeCount: number;
  liked: boolean;
  depth: number;
  createdAt: string;
  isDeleted: boolean;
  isRemoved: boolean;
  translation: FeedPost["translation"];
  author: PublicAuthor;
  children: PublicComment[];
};

export type PublicPostDetail = PublicFeedPost & {
  isLocked: boolean;
  comments: PublicComment[];
};

export type PublicLikeResult = {
  postId: string;
  likeCount: number;
  liked: boolean;
};

export type PublicCommentLikeResult = {
  commentId: string;
  likeCount: number;
  liked: boolean;
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
    likeCount: post.likeCount,
    liked: post.liked,
    saved: post.saved,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
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
): PublicFeedPost {
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
    likeCount: comment.likeCount,
    liked: comment.liked,
    depth: comment.depth,
    createdAt: comment.createdAt,
    isDeleted: comment.isDeleted,
    isRemoved: comment.isRemoved,
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

export function serializeLikeResult(result: {
  postId: string;
  likeCount: number;
  liked: boolean;
}): PublicLikeResult {
  return {
    postId: result.postId,
    likeCount: result.likeCount,
    liked: result.liked,
  };
}

export function serializeCommentLikeResult(result: {
  commentId: string;
  likeCount: number;
  liked: boolean;
}): PublicCommentLikeResult {
  return {
    commentId: result.commentId,
    likeCount: result.likeCount,
    liked: result.liked,
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
