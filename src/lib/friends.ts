import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { notifyQuietly } from "@/lib/notifications";
import { formatUserHandle, getUsernameProfileHref } from "@/lib/profile-url";
import { AuthError } from "@/lib/session";

export type FriendStatus = "none" | "outgoing" | "incoming" | "friends";

export type FriendListItem = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  since: string;
};

export type FriendRequestItem = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string;
    image: string | null;
  };
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type UserRow = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  status?: string;
};

export function friendPairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(":");
}

function relationFromRow(
  row: FriendshipRow | null,
  viewerId: string,
  isSelf = false
): {
  status: FriendStatus;
  requestId: string | null;
  isSelf: boolean;
} {
  if (isSelf || !row) {
    return { status: "none", requestId: null, isSelf };
  }
  if (row.status === "accepted") {
    return { status: "friends", requestId: null, isSelf: false };
  }
  if (row.status === "pending") {
    return {
      status: row.requester_id === viewerId ? "outgoing" : "incoming",
      requestId: row.id,
      isSelf: false,
    };
  }
  return { status: "none", requestId: null, isSelf: false };
}

async function getFriendshipByPair(
  db: D1Database,
  pairKey: string
): Promise<FriendshipRow | null> {
  return db
    .prepare(
      `SELECT id, requester_id, addressee_id, status, created_at
       FROM user_friendships
       WHERE pair_key = ?`
    )
    .bind(pairKey)
    .first<FriendshipRow>();
}

async function assertFriendable(
  db: D1Database,
  requesterId: string,
  addresseeId: string
): Promise<void> {
  if (requesterId === addresseeId) {
    throw new AuthError("You can't add yourself", 400);
  }

  const user = await db
    .prepare(`SELECT id, username, name, image, status FROM "user" WHERE id = ?`)
    .bind(addresseeId)
    .first<UserRow>();
  if (!user || user.status === "banned") {
    throw new AuthError("User not found", 404);
  }

  const blocked = await db
    .prepare(
      `SELECT 1 AS ok FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)`
    )
    .bind(requesterId, addresseeId, addresseeId, requesterId)
    .first();
  if (blocked) {
    throw new AuthError("Can't connect with this user", 403);
  }

  return;
}

export async function getFriendRelation(
  viewerId: string | null | undefined,
  profileUserId: string
) {
  if (!viewerId || viewerId === profileUserId) {
    return relationFromRow(null, viewerId ?? "", viewerId === profileUserId);
  }
  const db = await getDb();
  const row = await getFriendshipByPair(
    db,
    friendPairKey(viewerId, profileUserId)
  );
  return relationFromRow(row, viewerId);
}

export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string
) {
  const db = await getDb();
  await assertFriendable(db, requesterId, addresseeId);
  const pairKey = friendPairKey(requesterId, addresseeId);
  const current = await getFriendshipByPair(db, pairKey);

  if (current?.status === "accepted") {
    return {
      friendStatus: "friends" as const,
      requestId: null,
    };
  }
  if (current?.status === "pending") {
    return {
      friendStatus: (current.requester_id === requesterId
        ? "outgoing"
        : "incoming") as FriendStatus,
      requestId: current.id,
    };
  }

  const requestId = current?.id ?? createPublicId();
  let changed = 0;
  if (current) {
    const result = await db
      .prepare(
        `UPDATE user_friendships
         SET requester_id = ?, addressee_id = ?, status = 'pending',
             created_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'declined'
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
           )`
      )
      .bind(
        requesterId,
        addresseeId,
        requestId,
        requesterId,
        addresseeId,
        addresseeId,
        requesterId
      )
      .run();
    changed = Number(result.meta.changes ?? 0);
  } else {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO user_friendships (
           id, pair_key, requester_id, addressee_id, status
         )
         SELECT ?, ?, ?, ?, 'pending'
         WHERE NOT EXISTS (
           SELECT 1 FROM user_blocks
           WHERE (blocker_id = ? AND blocked_id = ?)
              OR (blocker_id = ? AND blocked_id = ?)
         )`
      )
      .bind(
        requestId,
        pairKey,
        requesterId,
        addresseeId,
        requesterId,
        addresseeId,
        addresseeId,
        requesterId
      )
      .run();
    changed = Number(result.meta.changes ?? 0);
  }

  if (changed !== 1) {
    const blocked = await db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)`
      )
      .bind(requesterId, addresseeId, addresseeId, requesterId)
      .first();
    if (blocked) throw new AuthError("Can't connect with this user", 403);
    const latest = await getFriendshipByPair(db, pairKey);
    if (latest?.status === "accepted") {
      return { friendStatus: "friends" as const, requestId: null };
    }
    if (latest?.status === "pending") {
      return {
        friendStatus: (latest.requester_id === requesterId
          ? "outgoing"
          : "incoming") as FriendStatus,
        requestId: latest.id,
      };
    }
    throw new AuthError("Friend request could not be created", 409);
  }

  const requester = await db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(requesterId)
    .first<{ username: string | null }>();
  notifyQuietly({
    userId: addresseeId,
    actorId: requesterId,
    kind: "friend_request",
    title: `${formatUserHandle(requester?.username)} sent you a friend request`,
    href: getUsernameProfileHref(requester?.username) ?? "/friends",
  });

  return {
    friendStatus: "outgoing" as const,
    requestId,
  };
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const db = await getDb();
  const request = await db
    .prepare(
      `SELECT id, requester_id, addressee_id, status, created_at
       FROM user_friendships
       WHERE id = ? AND addressee_id = ?`
    )
    .bind(requestId, userId)
    .first<FriendshipRow>();
  if (!request || request.status === "declined") {
    throw new AuthError("Friend request not found", 404);
  }
  if (request.status === "accepted") {
    const blocked = await db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)`
      )
      .bind(request.requester_id, userId, userId, request.requester_id)
      .first();
    if (blocked) throw new AuthError("Can't connect with this user", 403);
    const friend = await getFriendListItem(db, request.requester_id, request.created_at);
    return { friendStatus: "friends" as const, requestId: null, friend };
  }

  const result = await db
    .prepare(
      `UPDATE user_friendships
       SET status = 'accepted', updated_at = datetime('now')
       WHERE id = ? AND addressee_id = ? AND status = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks
           WHERE (blocker_id = requester_id AND blocked_id = addressee_id)
              OR (blocker_id = addressee_id AND blocked_id = requester_id)
         )`
    )
    .bind(requestId, userId)
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    const blocked = await db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)`
      )
      .bind(request.requester_id, userId, userId, request.requester_id)
      .first();
    if (blocked) throw new AuthError("Can't connect with this user", 403);
    const latest = await db
      .prepare(
        `SELECT id, requester_id, addressee_id, status, created_at
         FROM user_friendships WHERE id = ?`
      )
      .bind(requestId)
      .first<FriendshipRow>();
    if (latest?.status === "accepted") {
      const friend = await getFriendListItem(
        db,
        request.requester_id,
        latest.created_at
      );
      return { friendStatus: "friends" as const, requestId: null, friend };
    }
    throw new AuthError("Friend request is no longer available", 409);
  }

  const { promotePendingChatRequestsForPair } = await import("@/lib/messages");
  await promotePendingChatRequestsForPair(
    request.requester_id,
    userId,
    "friendship"
  );

  const actor = await db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(userId)
    .first<{ username: string | null }>();
  notifyQuietly({
    userId: request.requester_id,
    actorId: userId,
    kind: "friend_accepted",
    title: `${formatUserHandle(actor?.username)} accepted your friend request`,
    href: getUsernameProfileHref(actor?.username) ?? "/friends",
  });

  const friend = await getFriendListItem(db, request.requester_id, request.created_at);
  return {
    friendStatus: "friends" as const,
    requestId: null,
    friend,
  };
}


export async function declineFriendRequest(userId: string, requestId: string) {
  const db = await getDb();
  const result = await db
    .prepare(
      `UPDATE user_friendships
       SET status = 'declined', updated_at = datetime('now')
       WHERE id = ? AND addressee_id = ? AND status = 'pending'`
    )
    .bind(requestId, userId)
    .run();
  if (!result.meta.changes) {
    throw new AuthError("Friend request not found", 404);
  }
  return { friendStatus: "none" as const, requestId: null };
}

export async function cancelFriendRequest(userId: string, requestId: string) {
  const db = await getDb();
  const result = await db
    .prepare(
      `DELETE FROM user_friendships
       WHERE id = ? AND requester_id = ? AND status = 'pending'`
    )
    .bind(requestId, userId)
    .run();
  if (!result.meta.changes) {
    throw new AuthError("Friend request not found", 404);
  }
  return { friendStatus: "none" as const, requestId: null };
}

export async function cancelFriendRequestByUsers(
  requesterId: string,
  addresseeId: string
) {
  const db = await getDb();
  const request = await db
    .prepare(
      `SELECT id FROM user_friendships
       WHERE pair_key = ? AND requester_id = ? AND addressee_id = ?
         AND status = 'pending'`
    )
    .bind(friendPairKey(requesterId, addresseeId), requesterId, addresseeId)
    .first<{ id: string }>();
  if (!request) {
    throw new AuthError("Friend request not found", 404);
  }
  return cancelFriendRequest(requesterId, request.id);
}

export async function removeFriend(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw new AuthError("You can't remove yourself", 400);
  }
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM user_friendships
       WHERE pair_key = ? AND status = 'accepted'`
    )
    .bind(friendPairKey(userId, otherUserId))
    .run();
  return { friendStatus: "none" as const, requestId: null };
}

async function getFriendListItem(
  db: D1Database,
  userId: string,
  since: string
): Promise<FriendListItem | null> {
  const row = await db
    .prepare(
      `SELECT id, username, name, image
       FROM "user"
       WHERE id = ? AND status != 'banned'`
    )
    .bind(userId)
    .first<UserRow>();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username ?? row.id,
    name: row.name,
    image: row.image,
    since,
  };
}

export async function listFriends(userId: string): Promise<FriendListItem[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         f.created_at,
         CASE WHEN f.requester_id = ? THEN a.id ELSE r.id END AS id,
         CASE WHEN f.requester_id = ? THEN a.username ELSE r.username END AS username,
         CASE WHEN f.requester_id = ? THEN a.name ELSE r.name END AS name,
         CASE WHEN f.requester_id = ? THEN a.image ELSE r.image END AS image
       FROM user_friendships f
       JOIN "user" r ON r.id = f.requester_id
       JOIN "user" a ON a.id = f.addressee_id
       WHERE (f.requester_id = ? OR f.addressee_id = ?)
         AND f.status = 'accepted'
         AND (CASE WHEN f.requester_id = ? THEN a.status ELSE r.status END) != 'banned'
       ORDER BY f.updated_at DESC, f.id DESC`
    )
    .bind(
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId
    )
    .all<{
      created_at: string;
      id: string;
      username: string | null;
      name: string;
      image: string | null;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    username: row.username ?? row.id,
    name: row.name,
    image: row.image,
    since: row.created_at,
  }));
}

async function listFriendRequests(
  userId: string,
  direction: "incoming" | "outgoing"
): Promise<FriendRequestItem[]> {
  const db = await getDb();
  const isIncoming = direction === "incoming";
  const ownerColumn = isIncoming ? "f.addressee_id" : "f.requester_id";
  const otherAlias = isIncoming ? "r" : "a";
  const { results } = await db
    .prepare(
      `SELECT
         f.id, f.created_at,
         ${otherAlias}.id AS user_id,
         ${otherAlias}.username AS username,
         ${otherAlias}.name AS name,
         ${otherAlias}.image AS image
       FROM user_friendships f
       JOIN "user" r ON r.id = f.requester_id
       JOIN "user" a ON a.id = f.addressee_id
       WHERE ${ownerColumn} = ? AND f.status = 'pending'
         AND ${otherAlias}.status != 'banned'
       ORDER BY f.created_at DESC, f.id DESC`
    )
    .bind(userId)
    .all<{
      id: string;
      created_at: string;
      user_id: string;
      username: string | null;
      name: string;
      image: string | null;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username ?? row.user_id,
      name: row.name,
      image: row.image,
    },
  }));
}

export function listIncomingFriendRequests(userId: string) {
  return listFriendRequests(userId, "incoming");
}

export function listOutgoingFriendRequests(userId: string) {
  return listFriendRequests(userId, "outgoing");
}
