"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  MessageSquareIcon,
  RssIcon,
  UserPlusIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersRoundIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { announceUnreadChanged } from "@/components/notifications/use-unread-count";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { getUsernameProfileHref } from "@/lib/profile-url";
import type { RelationshipProjection } from "@/lib/user-actions";

type Action =
  | "follow"
  | "unfollow"
  | "block"
  | "unblock"
  | "friend_request"
  | "friend_cancel"
  | "friend_remove"
  | "friend_accept"
  | "friend_decline";

type RelationshipResponse = {
  relationship?: RelationshipProjection;
};

type ProfileActionsProps = {
  targetUserId: string;
  username: string;
  relationship: RelationshipProjection;
  showMessage?: boolean;
  compact?: boolean;
  showBlock?: boolean;
};

export function ProfileActions({
  targetUserId,
  username,
  relationship: initialRelationship,
  showMessage = true,
  compact = false,
  showBlock = true,
}: ProfileActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [relationship, setRelationship] = useState(initialRelationship);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const buttonClass = compact
    ? "min-h-8 gap-1 px-2 text-xs"
    : "min-h-11 gap-1.5 sm:min-h-8";
  function run(action: Action) {
    setError(null);
    startTransition(async () => {
      try {
        const isFriendApi =
          action === "friend_accept" || action === "friend_decline";
        const isBlockApi = action === "block" || action === "unblock";
        const endpoint = isBlockApi
          ? `/api/me/blocks/${encodeURIComponent(targetUserId)}`
          : isFriendApi
            ? "/api/friends"
            : `/api/users/${encodeURIComponent(username)}`;
        const method = action === "unblock" ? "DELETE" : "POST";
        const body = isBlockApi
          ? undefined
          : isFriendApi
            ? {
                action: action === "friend_accept" ? "accept" : "decline",
                requestId: relationship.friendRequestId,
              }
            : { action };
        const res = await apiFetch(endpoint, {
          method,
          ...(body
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        });
        if (res.status === 401) {
          router.push(
            `/login?next=${encodeURIComponent(
              getUsernameProfileHref(username) ?? "/"
            )}`
          );
          return;
        }
        const payload = (await res.json().catch(() => null)) as
          | (RelationshipResponse & { error?: string })
          | null;
        if (!res.ok) {
          setError(localizeError(payload?.error, "Action failed"));
          return;
        }
        if (!payload?.relationship) {
          setError(t("common.networkError"));
          return;
        }
        setRelationship(payload.relationship);
        if (action === "block") announceUnreadChanged();
        router.refresh();
      } catch {
        setError(t("common.networkError"));
      }
    });
  }

  const blockedByMe = relationship.blockState === "blocked_by_me";
  const friendState = relationship.friendState;
  const friendRequestId = relationship.friendRequestId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showMessage && relationship.canMessage ? (
        <Link
          href={`/messages?to=${encodeURIComponent(username)}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            buttonClass
          )}
        >
          <MessageSquareIcon className="size-4" aria-hidden />
          {t("profile.message")}
        </Link>
      ) : null}
      {relationship.canInteract ? (
        <>
          {friendState === "incoming_pending" ? (
            <>
              <Button
                type="button"
                size="sm"
                className={buttonClass}
                disabled={pending || !friendRequestId}
                onClick={() => run("friend_accept")}
              >
                <UserRoundCheckIcon className="size-4" aria-hidden />
                {t("profile.acceptFriend")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={buttonClass}
                disabled={pending || !friendRequestId}
                onClick={() => run("friend_decline")}
              >
                {t("profile.declineFriend")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={friendState === "none" ? "default" : "secondary"}
              className={buttonClass}
              disabled={pending}
              onClick={() =>
                run(
                  friendState === "none"
                    ? "friend_request"
                    : friendState === "outgoing_pending"
                      ? "friend_cancel"
                      : "friend_remove"
                )
              }
              title={
                friendState === "outgoing_pending"
                  ? t("profile.cancelFriend")
                  : friendState === "friends"
                    ? t("profile.removeFriend")
                    : undefined
              }
            >
              {friendState === "none" ? (
                <UserPlusIcon className="size-4" aria-hidden />
              ) : friendState === "friends" ? (
                <UsersRoundIcon className="size-4" aria-hidden />
              ) : (
                <UserRoundCheckIcon className="size-4" aria-hidden />
              )}
              {friendState === "none"
                ? t("profile.addFriend")
                : friendState === "outgoing_pending"
                  ? t("profile.friendRequestSent")
                  : t("profile.friends")}
            </Button>
          )}
        </>
      ) : null}
      {relationship.canInteract ? (
        <Button
          type="button"
          size="sm"
          variant={relationship.followState === "following" ? "outline" : "default"}
          className={buttonClass}
          disabled={pending}
          onClick={() =>
            run(
              relationship.followState === "following" ? "unfollow" : "follow"
            )
          }
          title={
            relationship.followState === "following"
              ? t("profile.unfollow")
              : t("profile.follow")
          }
        >
          <RssIcon className="size-4" aria-hidden />
          {relationship.followState === "following"
            ? t("profile.unfollow")
            : t("profile.follow")}
        </Button>
      ) : null}
      {showBlock ? (
        <Button
          type="button"
          size="sm"
          variant={blockedByMe ? "secondary" : "outline"}
          className={buttonClass}
          disabled={pending}
          onClick={() => run(blockedByMe ? "unblock" : "block")}
        >
          {blockedByMe ? null : (
            <UserRoundXIcon className="size-4" aria-hidden />
          )}
          {blockedByMe ? t("settings.unblock") : t("profile.block")}
        </Button>
      ) : null}
      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
