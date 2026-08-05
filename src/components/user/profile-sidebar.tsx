"use client";

import Link from "next/link";
import { Cake } from "lucide-react";

import { AchievementsShowcase } from "@/components/user/achievements-showcase";
import { AccountBadges } from "@/components/user/account-badges";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { UserAchievement } from "@/lib/achievements";
import { resolveAccountBadges } from "@/lib/achievement-levels";
import {
  formatAccountAge,
  formatCakeDayDate,
  isCakeDay,
} from "@/lib/account-age";
import type { PublicProfile } from "@/lib/content";

function formatKarma(n: number, locale: string): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return new Intl.NumberFormat(locale).format(n);
}

export function ProfileSidebar({
  profile,
  achievements,
  isOwner,
}: {
  profile: PublicProfile;
  achievements: UserAchievement[];
  isOwner: boolean;
}) {
  const { t, locale } = useI18n();
  const ageLabel = formatAccountAge(profile.createdAt, Date.now(), locale);
  const cakeDay = isCakeDay(profile.createdAt);
  const badges = resolveAccountBadges({
    karma: profile.karma,
    createdAt: profile.createdAt,
    locale: locale === "ru" ? "ru" : "en",
  });

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold">
          {profile.name || `u/${profile.username}`}
        </h2>
        {profile.bio ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        ) : isOwner ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("profile.addBio")}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          <AccountBadges badges={badges} size="sm" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("profile.karma")}</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">
              {formatKarma(profile.karma, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("profile.redditorFor")}
            </dt>
            <dd className="mt-0.5 text-sm font-medium">{ageLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("profile.postKarma")}
            </dt>
            <dd className="text-sm font-semibold tabular-nums">
              {formatKarma(profile.postKarma, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("profile.commentKarma")}
            </dt>
            <dd className="text-sm font-semibold tabular-nums">
              {formatKarma(profile.commentKarma, locale)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">{t("profile.cakeDay")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
            <Cake
              className={
                cakeDay
                  ? "size-3.5 text-[var(--brand)]"
                  : "size-3.5 text-muted-foreground"
              }
              aria-hidden
            />
            <time dateTime={profile.createdAt}>
              {formatCakeDayDate(profile.createdAt, locale)}
            </time>
            {cakeDay ? (
              <span className="text-xs font-medium text-[var(--brand)]">
                {t("profile.cakeDayToday")}
              </span>
            ) : null}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold">
          {t("profile.achievements")}
        </h2>
        <div className="mt-3">
          <AchievementsShowcase achievements={achievements} />
        </div>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
          <h2 className="font-heading text-sm font-semibold">
            {t("profile.settings")}
          </h2>
          <div className="mt-3 space-y-3">
            <Link
              href="/settings"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              {t("profile.settings")}
            </Link>
            <p className="text-xs text-muted-foreground">
              Avatar, banner, password, theme, privacy, and more.
            </p>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
