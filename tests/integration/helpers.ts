import { env } from "cloudflare:test";

export type SeededUsers = {
  authorId: string;
  voterId: string;
  subredditId: string;
  subredditName: string;
};

/** Insert two users + one community for action tests. */
export async function seedUsersAndSubreddit(
  suffix = crypto.randomUUID().slice(0, 8)
): Promise<SeededUsers> {
  const authorId = `u_author_${suffix}`;
  const voterId = `u_voter_${suffix}`;
  const subredditId = `s_${suffix}`;
  const subredditName = `c_${suffix}`;

  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
     VALUES (?, 'Author', ?, 1, ?, 50, 'user', 'active')`
  )
    .bind(authorId, `${authorId}@test.local`, `author_${suffix}`)
    .run();

  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
     VALUES (?, 'Voter', ?, 1, ?, 40, 'user', 'active')`
  )
    .bind(voterId, `${voterId}@test.local`, `voter_${suffix}`)
    .run();

  await env.DB.prepare(
    `INSERT INTO subreddits (id, name, title, created_by, subscriber_count)
     VALUES (?, ?, 'Test community', ?, 0)`
  )
    .bind(subredditId, subredditName, authorId)
    .run();

  return { authorId, voterId, subredditId, subredditName };
}

export async function getPostRow(postId: string) {
  return env.DB.prepare(
    `SELECT id, title, body, url, score, upvotes, downvotes, comment_count,
            is_removed, is_shadow_hidden, author_id
     FROM posts WHERE id = ?`
  )
    .bind(postId)
    .first<{
      id: string;
      title: string;
      body: string | null;
      url: string | null;
      score: number;
      upvotes: number;
      downvotes: number;
      comment_count: number;
      is_removed: number;
      is_shadow_hidden: number;
      author_id: string;
    }>();
}

export async function getCommentRow(commentId: string) {
  return env.DB.prepare(
    `SELECT id, body, score, is_deleted, is_removed, author_id, depth
     FROM comments WHERE id = ?`
  )
    .bind(commentId)
    .first<{
      id: string;
      body: string;
      score: number;
      is_deleted: number;
      is_removed: number;
      author_id: string;
      depth: number;
    }>();
}
