import Link from "next/link";
import { Cake, UsersRound } from "lucide-react";

import { AccountBadges } from "@/components/user/account-badges";
import { AccountTags } from "@/components/user/account-tags";
import { resolveAccountBadges } from "@/lib/achievement-levels";
import { ProfileActions } from "@/components/user/profile-actions";
import { ProfileAvatarEditor } from "@/components/user/profile-avatar-editor";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  formatAccountAge,
  formatCakeDayDate,
  isCakeDay,
} from "@/lib/account-age";
import type { PublicProfile } from "@/lib/content";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";

function formatKarma(n: number, locale: string): string {
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return new Intl.NumberFormat(locale).format(n);
}

export async function ProfileHeader({
  profile,
  isOwner,
  relation,
}: {
  profile: PublicProfile;
  isOwner: boolean;
  relation: {
    following: boolean;
    blocked: boolean;
    friendStatus: "none" | "outgoing" | "incoming" | "friends";
    friendRequestId: string | null;
  };
}) {
  const { locale } = await getRequestLocale();
  const username = profile.username ?? "unknown";
  const displayName = profile.name?.trim() || username;
  const ageLabel = formatAccountAge(profile.createdAt, undefined, locale);
  const cakeDay = isCakeDay(profile.createdAt);
  const badges = resolveAccountBadges({
    karma: profile.karma,
    createdAt: profile.createdAt,
    locale,
  });

  return (
    <header className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
      <div
        className="h-1 bg-[linear-gradient(90deg,var(--flag-red)_0%,var(--flag-red)_38%,var(--flag-gold)_38%,var(--flag-gold)_68%,var(--flag-red)_68%,var(--flag-red)_100%)]"
        aria-hidden
      />
      <div className="relative px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {isOwner ? (
            <div className="rounded-full bg-background p-1 ring-1 ring-border/60">
              <ProfileAvatarEditor
                username={username}
                image={profile.image}
                compact
              />
            </div>
          ) : (
            <div className="rounded-full bg-background p-1 ring-1 ring-border/60">
              <Link
                href={`/u/${encodeURIComponent(username)}`}
                aria-label={`@${username}`}
                className="block rounded-full"
              >
                <UserAvatar
                  username={username}
                  image={profile.image}
                  size="2xl"
                />
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pb-1">
            {isOwner ? (
              <>
                <Link
                  href="/friends"
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-4xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <UsersRound className="size-4" aria-hidden />
                  {tLocale(locale, "profile.manageFriends")}
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex min-h-9 items-center justify-center rounded-4xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {tLocale(locale, "profile.editProfile")}
                </Link>
              </>
            ) : (
              <ProfileActions
                username={username}
                initiallyFollowing={relation.following}
                initiallyBlocked={relation.blocked}
                initiallyFriendStatus={relation.friendStatus}
                initiallyFriendRequestId={relation.friendRequestId}
              />
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            {cakeDay ? (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_oklch,var(--brand)_16%,transparent)] px-1.5 py-0.5 text-xs font-semibold text-[var(--brand)]"
                title={tLocale(locale, "profile.cakeDayHappy")}
              >
                <Cake className="size-3.5" aria-hidden />
                {tLocale(locale, "profile.cakeDay")}
              </span>
            ) : null}
            <AccountTags tags={profile.tags} size="md" />
            <AccountBadges badges={badges} size="md" />
          </div>
          @{username}
        </div>

        {profile.bio ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed lg:hidden">
            {profile.bio}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground lg:hidden">
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatKarma(profile.karma, locale)}
            </span>{" "}
            {tLocale(locale, "profile.karma")}
          </span>
          <span>
            {tLocale(locale, "profile.memberFor")}{" "}
            <span className="font-medium text-foreground">{ageLabel}</span>
          </span>
          <span
            className="inline-flex items-center gap-1"
            title={formatCakeDayDate(profile.createdAt, locale)}
          >
            <Cake className="size-3.5 text-[var(--brand)]" aria-hidden />
            <time dateTime={profile.createdAt}>
              {formatCakeDayDate(profile.createdAt, locale)}
            </time>
          </span>
        </div>
      </div>
    </header>
  );
}
