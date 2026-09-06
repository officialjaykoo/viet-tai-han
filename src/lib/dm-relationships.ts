import { getDb } from "@/lib/db";
import type { AllowDms } from "@/lib/user-settings";

export type DmRelationship = {
  blocked: boolean;
  friends: boolean;
  senderFollowsRecipient: boolean;
  recipientFollowsSender: boolean;
  allowDms: AllowDms;
  directAllowed: boolean;
  requestAllowed: boolean;
};

function pairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(":");
}

function normalizeAllowDms(value: unknown): AllowDms {
  if (value === "followers" || value === "nobody") return value;
  return "anyone";
}

/**
 * Evaluate the complete DM relationship policy for one sender/recipient pair.
 * Follow directions are intentionally named from the participants' perspective
 * so request privacy and direct access cannot accidentally share a query.
 */
export async function getDmRelationship(input: {
  senderId: string;
  recipientId: string;
}): Promise<DmRelationship> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT
         EXISTS (
           SELECT 1 FROM user_blocks
           WHERE (blocker_id = ? AND blocked_id = ?)
              OR (blocker_id = ? AND blocked_id = ?)
         ) AS blocked,
         EXISTS (
           SELECT 1 FROM user_friendships
           WHERE pair_key = ? AND status = 'accepted'
         ) AS friends,
         EXISTS (
           SELECT 1 FROM user_follows
           WHERE follower_id = ? AND following_id = ?
         ) AS sender_follows_recipient,
         EXISTS (
           SELECT 1 FROM user_follows
           WHERE follower_id = ? AND following_id = ?
         ) AS recipient_follows_sender,
         COALESCE(
           (SELECT allowDms FROM "user" WHERE id = ?),
           'anyone'
         ) AS allow_dms`
    )
    .bind(
      input.senderId,
      input.recipientId,
      input.recipientId,
      input.senderId,
      pairKey(input.senderId, input.recipientId),
      input.senderId,
      input.recipientId,
      input.recipientId,
      input.senderId,
      input.recipientId
    )
    .first<{
      blocked: number;
      friends: number;
      sender_follows_recipient: number;
      recipient_follows_sender: number;
      allow_dms: string | null;
    }>();

  const blocked = Boolean(row?.blocked);
  const friends = Boolean(row?.friends);
  const senderFollowsRecipient = Boolean(row?.sender_follows_recipient);
  const recipientFollowsSender = Boolean(row?.recipient_follows_sender);
  const allowDms = normalizeAllowDms(row?.allow_dms);
  const directAllowed =
    !blocked && (friends || recipientFollowsSender);
  const requestAllowed =
    !blocked &&
    !directAllowed &&
    (allowDms === "anyone" ||
      (allowDms === "followers" && senderFollowsRecipient));

  return {
    blocked,
    friends,
    senderFollowsRecipient,
    recipientFollowsSender,
    allowDms,
    directAllowed,
    requestAllowed,
  };
}
