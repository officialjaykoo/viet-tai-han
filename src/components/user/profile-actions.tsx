"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  MessageSquareIcon,
  UserMinusIcon,
  UserPlusIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type FriendStatus = "none" | "outgoing" | "incoming" | "friends";
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

type FriendResponse = {
  friendStatus?: FriendStatus;
  requestId?: string | null;
};

type ProfileActionsProps = {
  username: string;
  initiallyFollowing: boolean;
  initiallyBlocked: boolean;
  initiallyFriendStatus: FriendStatus;
  initiallyFriendRequestId: string | null;
  showMessage?: boolean;
};

export function ProfileActions({
  username,
  initiallyFollowing,
  initiallyBlocked,
  initiallyFriendStatus,
  initiallyFriendRequestId,
  showMessage = true,
}: ProfileActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [friendStatus, setFriendStatus] = useState(initiallyFriendStatus);
  const [friendRequestId, setFriendRequestId] = useState(
    initiallyFriendRequestId
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: Action) {
    setError(null);
    startTransition(async () => {
      const isFriendApi =
        action === "friend_accept" || action === "friend_decline";
      const endpoint = isFriendApi
        ? "/api/friends"
        : `/api/users/${encodeURIComponent(username)}`;
      const body = isFriendApi
        ? {
            action: action === "friend_accept" ? "accept" : "decline",
            requestId: friendRequestId,
          }
        : { action };
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
        return;
      }
      const payload = (await res.json().catch(() => null)) as
        | (FriendResponse & { error?: string })
        | null;
      if (!res.ok) {
        setError(localizeError(payload?.error, "Action failed"));
        return;
      }

      if (action === "follow") setFollowing(true);
      if (action === "unfollow") setFollowing(false);
      if (action === "block") {
        setBlocked(true);
        setFollowing(false);
        setFriendStatus("none");
        setFriendRequestId(null);
      }
      if (action === "unblock") setBlocked(false);
      if (action === "friend_request") {
        setFriendStatus(payload?.friendStatus ?? "outgoing");
        setFriendRequestId(payload?.requestId ?? null);
      }
      if (
        action === "friend_cancel" ||
        action === "friend_remove" ||
        action === "friend_decline"
      ) {
        setFriendStatus("none");
        setFriendRequestId(null);
      }
      if (action === "friend_accept") {
        setFriendStatus("friends");
        setFriendRequestId(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showMessage && !blocked ? (
        <Link
          href={`/messages?to=${encodeURIComponent(username)}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "min-h-11 gap-1.5 sm:min-h-8"
          )}
        >
          <MessageSquareIcon className="size-4" aria-hidden />
          {t("profile.message")}
        </Link>
      ) : null}
      {!blocked ? (
        <>
          {friendStatus === "incoming" ? (
            <>
              <Button
                type="button"
                size="sm"
                className="min-h-11 gap-1.5 sm:min-h-8"
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
                className="min-h-11 sm:min-h-8"
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
              variant={
                friendStatus === "none" ? "default" : "secondary"
              }
              className="min-h-11 gap-1.5 sm:min-h-8"
              disabled={pending}
              onClick={() =>
                run(
                  friendStatus === "none"
                    ? "friend_request"
                    : friendStatus === "outgoing"
                      ? "friend_cancel"
                      : "friend_remove"
                )
              }
              title={
                friendStatus === "outgoing"
                  ? t("profile.cancelFriend")
                  : friendStatus === "friends"
                    ? t("profile.removeFriend")
                    : undefined
              }
            >
              {friendStatus === "none" ? (
                <UserPlusIcon className="size-4" aria-hidden />
              ) : friendStatus === "friends" ? (
                <UsersRoundIcon className="size-4" aria-hidden />
              ) : (
                <UserRoundCheckIcon className="size-4" aria-hidden />
              )}
              {friendStatus === "none"
                ? t("profile.addFriend")
                : friendStatus === "outgoing"
                  ? t("profile.friendRequestSent")
                  : t("profile.friends")}
            </Button>
          )}
          <Link
            href="/friends"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "min-h-11 gap-1.5 sm:min-h-8"
            )}
          >
            <UsersRoundIcon className="size-4" aria-hidden />
            {t("profile.manageFriends")}
          </Link>
        </>
      ) : null}
      {!blocked ? (
        <Button
          type="button"
          size="sm"
          variant={following ? "outline" : "default"}
          className="min-h-11 gap-1.5 sm:min-h-8"
          disabled={pending}
          onClick={() => run(following ? "unfollow" : "follow")}
        >
          {following ? (
            <UserRoundCheckIcon className="size-4" aria-hidden />
          ) : (
            <UserRoundPlusIcon className="size-4" aria-hidden />
          )}
          {following ? t("profile.unfollow") : t("profile.follow")}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={blocked ? "secondary" : "outline"}
        className="min-h-11 gap-1.5 sm:min-h-8"
        disabled={pending}
        onClick={() => run(blocked ? "unblock" : "block")}
      >
        {blocked ? null : <UserMinusIcon className="size-4" aria-hidden />}
        {blocked ? t("settings.unblock") : t("profile.block")}
      </Button>
      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
