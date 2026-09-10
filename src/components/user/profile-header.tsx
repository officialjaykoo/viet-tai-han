import Link from "next/link";

import { AccountTags } from "@/components/user/account-tags";
import { ProfileActions } from "@/components/user/profile-actions";
import { ProfileAvatarEditor } from "@/components/user/profile-avatar-editor";
import { UserAvatar } from "@/components/user/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import type { PublicProfile } from "@/lib/content";
import { formatAbsoluteDate } from "@/lib/format-time";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getUsernameProfileHref } from "@/lib/profile-url";
import type { RelationshipProjection } from "@/lib/user-actions";

export async function ProfileHeader({
  profile,
  targetUserId,
  isOwner,
  relation,
}: {
  profile: PublicProfile;
  targetUserId: string;
  isOwner: boolean;
  relation: RelationshipProjection;
}) {
  const { locale } = await getRequestLocale();
  const username = profile.username ?? "unknown";
  const displayName = profile.name?.trim() || username;

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
                href={getUsernameProfileHref(username) ?? "/"}
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
              <Link
                href="/settings"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {tLocale(locale, "profile.editProfile")}
              </Link>
            ) : (
              <ProfileActions
                targetUserId={targetUserId}
                username={username}
                relationship={relation}
              />
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            <AccountTags tags={profile.tags} size="md" />
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
            {tLocale(locale, "profile.memberFor")}{" "}
            <time
              className="font-medium text-foreground"
              dateTime={profile.createdAt}
            >
              {formatAbsoluteDate(profile.createdAt, locale)}
            </time>
          </span>
        </div>
      </div>
    </header>
  );
}
