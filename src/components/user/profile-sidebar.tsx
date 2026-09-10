"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n/i18n-provider";
import { buttonVariants } from "@/components/ui/button";
import type { PublicProfile } from "@/lib/content";
import { formatAbsoluteDate } from "@/lib/format-time";

export function ProfileSidebar({
  profile,
  isOwner,
}: {
  profile: PublicProfile;
  isOwner: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold">
          {profile.name || `@${profile.username}`}
        </h2>
        {profile.bio ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        ) : isOwner ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("profile.addBio")}</p>
        ) : null}
        <dl className="mt-4 border-t border-border/50 pt-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("profile.memberFor")}
            </dt>
            <dd className="mt-0.5 text-sm font-medium">
              <time dateTime={profile.createdAt}>
                {formatAbsoluteDate(profile.createdAt, locale)}
              </time>
            </dd>
          </div>
        </dl>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
          <h2 className="font-heading text-sm font-semibold">
            {t("profile.settings")}
          </h2>
          <div className="mt-3 space-y-3">
            <Link
              href="/settings"
              className={buttonVariants({ className: "w-full" })}
            >
              {t("profile.settings")}
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("settings.customizeProfileDesc")}
            </p>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
