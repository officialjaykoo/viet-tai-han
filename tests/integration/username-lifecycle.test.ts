import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { resolvePublicProfile } from "@/lib/content";
import { friendPairKey } from "@/lib/friends";
import { completeOnboarding } from "@/lib/onboarding";
import { changeUsername } from "@/lib/username-lifecycle";

async function insertUser(input: {
  id: string;
  username: string;
  onboardingComplete?: 0 | 1;
  onboardingUsernameCandidate?: string | null;
  usernameChangedAt?: string | null;
}) {
  await env.DB.prepare(
    `INSERT INTO "user" (
       id, name, email, emailVerified, username,
       onboardingUsernameCandidate, usernameChangedAt, onboardingComplete,
       role, status, preferredLanguage
     ) VALUES (?, 'Lifecycle User', ?, 0, ?, ?, ?, ?, 'user', 'active', 'en')`
  )
    .bind(
      input.id,
      `${input.id}@oauth.test`,
      input.username,
      input.onboardingUsernameCandidate ?? null,
      input.usernameChangedAt ?? null,
      input.onboardingComplete ?? 1
    )
    .run();
}

describe("username lifecycle", () => {
  it("rejects an active duplicate but permits duplicate onboarding candidates", async () => {
    const ownerId = `username_owner_${crypto.randomUUID()}`;
    const duplicateId = `username_duplicate_${crypto.randomUUID()}`;
    await insertUser({ id: ownerId, username: "active_owner" });
    await insertUser({ id: duplicateId, username: "active_other" });

    await expect(
      changeUsername({ userId: duplicateId, username: "ACTIVE_OWNER" })
    ).rejects.toMatchObject({ status: 409 });

    const firstCandidateId = `candidate_first_${crypto.randomUUID()}`;
    const secondCandidateId = `candidate_second_${crypto.randomUUID()}`;
    await insertUser({
      id: firstCandidateId,
      username: `tmp_${crypto.randomUUID().slice(0, 8)}`,
      onboardingComplete: 0,
      onboardingUsernameCandidate: "same_provider_name",
    });
    await insertUser({
      id: secondCandidateId,
      username: `tmp_${crypto.randomUUID().slice(0, 8)}`,
      onboardingComplete: 0,
      onboardingUsernameCandidate: "same_provider_name",
    });

    await expect(
      completeOnboarding({
        userId: firstCandidateId,
        name: "First Candidate",
        username: `candidate_one_${crypto.randomUUID().slice(0, 6)}`,
        preferredLanguage: "en",
      })
    ).resolves.toMatchObject({ onboardingComplete: true });
    await expect(
      completeOnboarding({
        userId: secondCandidateId,
        name: "Second Candidate",
        username: `candidate_two_${crypto.randomUUID().slice(0, 6)}`,
        preferredLanguage: "en",
      })
    ).resolves.toMatchObject({ onboardingComplete: true });
  });
 
  it("allows only one concurrent owner of a new username", async () => {
    const firstId = `username_race_first_${crypto.randomUUID()}`;
    const secondId = `username_race_second_${crypto.randomUUID()}`;
    const firstUsername = `race_first_${crypto.randomUUID().slice(0, 6)}`;
    const secondUsername = `race_second_${crypto.randomUUID().slice(0, 6)}`;
    const targetUsername = `race_target_${crypto.randomUUID().slice(0, 6)}`;
    await insertUser({ id: firstId, username: firstUsername });
    await insertUser({ id: secondId, username: secondUsername });

    const results = await Promise.allSettled([
      changeUsername({ userId: firstId, username: targetUsername }),
      changeUsername({ userId: secondId, username: targetUsername }),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<unknown> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ status: 409 });

    const ownerCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM "user" WHERE username = ? COLLATE NOCASE`
    )
      .bind(targetUsername)
      .first<{ count: number }>();
    expect(ownerCount?.count).toBe(1);
  });

  it("records history and redirects an old public username", async () => {
    const userId = `username_history_${crypto.randomUUID()}`;
    const oldUsername = `history_old_${crypto.randomUUID().slice(0, 6)}`;
    const newUsername = `history_new_${crypto.randomUUID().slice(0, 6)}`;
    await insertUser({ id: userId, username: oldUsername });

    const settings = await changeUsername({
      userId,
      username: newUsername,
    });
    expect(settings.username).toBe(newUsername);
    expect(settings.usernameChangedAt).toMatch(/^\d{4}-\d{2}-\d{2} /);

    const history = await env.DB.prepare(
      `SELECT userId, username, reservedUntil
       FROM username_history WHERE userId = ? AND username = ?`
    )
      .bind(userId, oldUsername)
      .first<{ userId: string; username: string; reservedUntil: string }>();
    expect(history).toMatchObject({ userId, username: oldUsername });
    expect(new Date(history!.reservedUntil).getTime()).toBeGreaterThan(Date.now());

    const oldLookup = await resolvePublicProfile(oldUsername.toUpperCase());
    expect(oldLookup).toMatchObject({
      redirectUsername: newUsername,
      profile: { id: userId, username: newUsername },
    });
    expect(await resolvePublicProfile(newUsername)).toMatchObject({
      redirectUsername: null,
      profile: { id: userId, username: newUsername },
    });
  });

  it("enforces cooldown and the finite historical username hold", async () => {
    const userId = `username_cooldown_${crypto.randomUUID()}`;
    const otherUserId = `username_reuse_${crypto.randomUUID()}`;
    const oldUsername = `held_old_${crypto.randomUUID().slice(0, 6)}`;
    const currentUsername = `held_new_${crypto.randomUUID().slice(0, 6)}`;
    const otherUsername = `held_other_${crypto.randomUUID().slice(0, 6)}`;
    await insertUser({ id: userId, username: oldUsername });
    await insertUser({ id: otherUserId, username: otherUsername });

    await changeUsername({ userId, username: currentUsername });
    await expect(
      changeUsername({ userId, username: `held_again_${crypto.randomUUID().slice(0, 5)}` })
    ).rejects.toMatchObject({ status: 429 });
 
    const postCooldownUsername = `held_after_${crypto.randomUUID().slice(0, 5)}`;
    await env.DB.prepare(
      `UPDATE "user" SET usernameChangedAt = '2000-01-01 00:00:00'
       WHERE id = ?`
    )
      .bind(userId)
      .run();
    await expect(
      changeUsername({ userId, username: postCooldownUsername })
    ).resolves.toMatchObject({ username: postCooldownUsername });

    await expect(
      changeUsername({ userId: otherUserId, username: oldUsername })
    ).rejects.toMatchObject({ status: 409 });

    await env.DB.prepare(
      `UPDATE username_history SET reservedUntil = '2000-01-01 00:00:00'
       WHERE userId = ? AND username = ?`
    )
      .bind(userId, oldUsername)
      .run();

    await expect(
      changeUsername({ userId: otherUserId, username: oldUsername })
    ).resolves.toMatchObject({ username: oldUsername });
  });

  it("keeps content ownership attached to the immutable user id", async () => {
    const authorId = `username_fk_author_${crypto.randomUUID()}`;
    const viewerId = `username_fk_viewer_${crypto.randomUUID()}`;
    const oldUsername = `fk_old_${crypto.randomUUID().slice(0, 6)}`;
    const newUsername = `fk_new_${crypto.randomUUID().slice(0, 6)}`;
    const subredditId = `username_fk_subreddit_${crypto.randomUUID()}`;
    const postId = `username_fk_post_${crypto.randomUUID()}`;
    const commentId = `username_fk_comment_${crypto.randomUUID()}`;
    await insertUser({ id: authorId, username: oldUsername });
    await insertUser({ id: viewerId, username: `fk_viewer_${crypto.randomUUID().slice(0, 6)}` });

    await env.DB.prepare(
      `INSERT INTO subreddits (id, name, title, created_by)
       VALUES (?, ?, 'Username FK test', ?)`
    )
      .bind(subredditId, `username_fk_${crypto.randomUUID().slice(0, 8)}`, authorId)
      .run();
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, 'Username FK post', 'body')`
    )
      .bind(postId, subredditId, authorId)
      .run();
    await env.DB.prepare(
      `INSERT INTO comments (id, post_id, author_id, body)
       VALUES (?, ?, ?, 'comment')`
    )
      .bind(commentId, postId, authorId)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES (?, ?)`
    )
      .bind(viewerId, authorId)
      .run();

    await changeUsername({ userId: authorId, username: newUsername });

    const ownership = await env.DB.prepare(
      `SELECT
         (SELECT author_id FROM posts WHERE id = ?) AS postAuthor,
         (SELECT author_id FROM comments WHERE id = ?) AS commentAuthor,
         (SELECT following_id FROM user_follows
          WHERE follower_id = ? AND following_id = ?) AS followedUser`
    )
      .bind(postId, commentId, viewerId, authorId)
      .first<{
        postAuthor: string;
        commentAuthor: string;
        followedUser: string;
      }>();
    expect(ownership).toEqual({
      postAuthor: authorId,
      commentAuthor: authorId,
      followedUser: authorId,
    });
  });
  it("keeps social and DM relationships attached to the immutable user id", async () => {
    const suffix = crypto.randomUUID();
    const authorId = `username_relation_author_${suffix}`;
    const viewerId = `username_relation_viewer_${suffix}`;
    const oldUsername = `relation_old_${crypto.randomUUID().slice(0, 6)}`;
    const newUsername = `relation_new_${crypto.randomUUID().slice(0, 6)}`;
    const friendshipId = `username_relation_friendship_${suffix}`;
    const roomId = `username_relation_room_${suffix}`;
    const messageId = `username_relation_message_${suffix}`;
    const requestId = `username_relation_request_${suffix}`;

    await insertUser({ id: authorId, username: oldUsername });
    await insertUser({
      id: viewerId,
      username: `relation_viewer_${crypto.randomUUID().slice(0, 6)}`,
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)`
      ).bind(viewerId, authorId),
      env.DB.prepare(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).bind(authorId, viewerId),
      env.DB.prepare(
        `INSERT INTO user_friendships (
           id, pair_key, requester_id, addressee_id, status
         ) VALUES (?, ?, ?, ?, 'accepted')`
      ).bind(
        friendshipId,
        friendPairKey(viewerId, authorId),
        viewerId,
        authorId
      ),
      env.DB.prepare(
        `INSERT INTO chat_rooms (id, pair_key, created_by)
         VALUES (?, ?, ?)`
      ).bind(roomId, friendPairKey(viewerId, authorId), authorId),
      env.DB.prepare(
        `INSERT INTO chat_room_members (
           room_id, user_id, role, membership_status
         ) VALUES (?, ?, 'owner', 'active')`
      ).bind(roomId, authorId),
      env.DB.prepare(
        `INSERT INTO chat_room_members (
           room_id, user_id, role, membership_status
         ) VALUES (?, ?, 'member', 'active')`
      ).bind(roomId, viewerId),
      env.DB.prepare(
        `INSERT INTO chat_messages (id, room_id, sender_id, body)
         VALUES (?, ?, ?, 'identity relationship test')`
      ).bind(messageId, roomId, authorId),
      env.DB.prepare(
        `INSERT INTO chat_requests (
           id, room_id, from_user_id, to_user_id, opener_body
         ) VALUES (?, ?, ?, ?, 'identity request')`
      ).bind(requestId, roomId, authorId, viewerId),
    ]);

    await changeUsername({ userId: authorId, username: newUsername });

    const relationships = await env.DB.prepare(
      `SELECT
         (SELECT following_id FROM user_follows
          WHERE follower_id = ? AND following_id = ?) AS followedUser,
         (SELECT blocker_id FROM user_blocks
          WHERE blocker_id = ? AND blocked_id = ?) AS blockerUser,
         (SELECT addressee_id FROM user_friendships WHERE id = ?) AS friendUser,
         (SELECT created_by FROM chat_rooms WHERE id = ?) AS roomOwner,
         (SELECT user_id FROM chat_room_members
          WHERE room_id = ? AND user_id = ?) AS memberUser,
         (SELECT sender_id FROM chat_messages WHERE id = ?) AS senderUser,
         (SELECT from_user_id FROM chat_requests WHERE id = ?) AS requestUser,
         (SELECT id FROM "user" WHERE username = ?) AS renamedUser`
    )
      .bind(
        viewerId,
        authorId,
        authorId,
        viewerId,
        friendshipId,
        roomId,
        roomId,
        authorId,
        messageId,
        requestId,
        newUsername
      )
      .first<{
        followedUser: string;
        blockerUser: string;
        friendUser: string;
        roomOwner: string;
        memberUser: string;
        senderUser: string;
        requestUser: string;
        renamedUser: string;
      }>();

    expect(relationships).toEqual({
      followedUser: authorId,
      blockerUser: authorId,
      friendUser: authorId,
      roomOwner: authorId,
      memberUser: authorId,
      senderUser: authorId,
      requestUser: authorId,
      renamedUser: authorId,
    });
  });
});
