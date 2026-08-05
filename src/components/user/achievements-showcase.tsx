"use client";

import { Trophy } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import {
  LEVEL_THRESHOLDS,
  nextThreshold,
  type LeveledSlug,
} from "@/lib/achievement-levels";
import type { UserAchievement } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const TITLE_I18N: Partial<Record<string, { en: string; ru: string }>> = {
  poster: { en: "Poster", ru: "Автор постов" },
  commenter: { en: "Commenter", ru: "Комментатор" },
  karma_climber: { en: "Karma Climber", ru: "Карабкатель по карме" },
  community_leader: { en: "Community Leader", ru: "Лидер сообществ" },
  follower_magnet: { en: "Follower Magnet", ru: "Магнит подписчиков" },
  social_butterfly: { en: "Social Butterfly", ru: "Общительный" },
  popular_post: { en: "Crowd Favorite", ru: "Любимец толпы" },
  voter: { en: "Voter", ru: "Голосующий" },
  cake_day: { en: "Cake Day", ru: "День торта" },
  conversationalist: { en: "Conversationalist", ru: "Собеседник" },
  link_poster: { en: "Link Sharer", ru: "Делится ссылками" },
  media_maven: { en: "Media Maven", ru: "Медиа-мастер" },
  welcome: { en: "Welcome Aboard", ru: "Добро пожаловать" },
  busy_bee: { en: "Busy Bee", ru: "Трудяга" },
  laefye: { en: "laefye", ru: "laefye" },
  first_post: { en: "First Post", ru: "Первый пост" },
  first_comment: { en: "First Comment", ru: "Первый комментарий" },
  community_builder: { en: "Community Builder", ru: "Создатель сообщества" },
  badge_karma: { en: "Karma Badge", ru: "Значок кармы" },
  badge_age: { en: "Member Since", ru: "С нами с" },
};

export function AchievementsShowcase({
  achievements,
}: {
  achievements: UserAchievement[];
}) {
  const { locale, t } = useI18n();
  const visible = achievements.filter(
    (a) =>
      a.kind === "achievement" &&
      !["karma_100", "karma_1000"].includes(a.slug)
  );
  const badges = achievements.filter((a) => a.kind === "badge");

  if (!visible.length && !badges.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {locale === "ru" ? "Пока нет трофеев." : "No trophies yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {badges.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {locale === "ru" ? "Значки" : "Badges"}
          </p>
          <ul className="space-y-2">
            {badges.map((item) => (
              <AchievementRow
                key={item.id}
                item={item}
                locale={locale}
                highlight
              />
            ))}
          </ul>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Trophy className="size-3.5 text-[var(--brand)]" aria-hidden />
            {t("profile.achievements")}
          </p>
          <ul className="space-y-2">
            {visible.map((item) => (
              <AchievementRow key={item.id} item={item} locale={locale} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AchievementRow({
  item,
  locale,
  highlight = false,
}: {
  item: UserAchievement;
  locale: string;
  highlight?: boolean;
}) {
  const i18n = TITLE_I18N[item.slug];
  const title =
    i18n && (locale === "ru" ? i18n.ru : i18n.en)
      ? locale === "ru"
        ? i18n.ru
        : i18n.en
      : item.title;
  const thresholds =
    item.slug in LEVEL_THRESHOLDS
      ? LEVEL_THRESHOLDS[item.slug as LeveledSlug]
      : null;
  const next =
    thresholds && item.level < item.maxLevel
      ? nextThreshold(thresholds, item.level)
      : null;
  const progress =
    thresholds && next != null
      ? Math.min(100, Math.round((item.level / item.maxLevel) * 100))
      : item.maxLevel > 1
        ? Math.round((item.level / item.maxLevel) * 100)
        : 100;

  return (
    <li
      className={cn(
        "rounded-xl border px-3 py-2.5",
        highlight
          ? "border-[color-mix(in_oklch,var(--brand)_30%,transparent)] bg-[color-mix(in_oklch,var(--brand)_6%,transparent)]"
          : "border-border/50 bg-card/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {title}
            {item.maxLevel > 1 ? (
              <span className="ml-1.5 text-xs font-semibold text-[var(--brand)] tabular-nums">
                Lv {item.level}
                {item.maxLevel > 1 ? `/${item.maxLevel}` : null}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>
      {item.maxLevel > 1 ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {next != null ? (
            <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
              {locale === "ru" ? "До след. уровня:" : "Next level:"} {next}
            </p>
          ) : (
            <p className="mt-1 text-[10px] font-medium text-[var(--brand)]">
              {locale === "ru" ? "Макс. уровень" : "Max level"}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
