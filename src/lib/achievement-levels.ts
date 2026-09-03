import { accountAgeDays } from "@/lib/account-age";
import type { Locale } from "@/lib/i18n/config";

/** Thresholds: index 0 = level 1 */
export const LEVEL_THRESHOLDS = {
  poster: [1, 10, 50, 100, 500],
  commenter: [1, 10, 50, 100, 500],
  karma_climber: [10, 100, 1_000, 10_000, 50_000, 100_000],
  community_leader: [1, 3, 10],
  follower_magnet: [1, 10, 50, 100],
  social_butterfly: [1, 10, 50],
  popular_post: [10, 50, 100, 500, 1_000],
  voter: [10, 100, 500, 1_000],
  cake_day: [1, 2, 3, 5, 7, 10, 12, 15, 20, 25], // years
  conversationalist: [1, 10, 50, 100],
  link_poster: [1, 10, 50],
  media_maven: [1, 10, 50],
  badge_karma: [0, 100, 1_000, 10_000, 50_000, 100_000],
  badge_age: [0, 365, 365 * 2, 365 * 3, 365 * 5, 365 * 10], // days
} as const;

export type LeveledSlug = keyof typeof LEVEL_THRESHOLDS;

export function levelForValue(
  thresholds: readonly number[],
  value: number
): number {
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]!) level = i + 1;
    else break;
  }
  return level;
}

export function nextThreshold(
  thresholds: readonly number[],
  level: number
): number | null {
  if (level >= thresholds.length) return null;
  return thresholds[level] ?? null;
}

export type KarmaBadgeTier = {
  level: number;
  id: string;
  labelEn: string;
  labelRu: string;
  labelVi: string;
  labelKo: string;
  minKarma: number;
};

/** Cooler badge as reputation grows — shown on profiles. */
export const KARMA_BADGE_TIERS: KarmaBadgeTier[] = [
  {
    level: 1,
    id: "new",
    labelEn: "New",
    labelRu: "Новичок",
    labelVi: "Mới",
    labelKo: "새 회원",
    minKarma: 0,
  },
  {
    level: 2,
    id: "bronze",
    labelEn: "Bronze",
    labelRu: "Бронза",
    labelVi: "Đồng",
    labelKo: "브론즈",
    minKarma: 100,
  },
  {
    level: 3,
    id: "silver",
    labelEn: "Silver",
    labelRu: "Серебро",
    labelVi: "Bạc",
    labelKo: "실버",
    minKarma: 1_000,
  },
  {
    level: 4,
    id: "gold",
    labelEn: "Gold",
    labelRu: "Золото",
    labelVi: "Vàng",
    labelKo: "골드",
    minKarma: 10_000,
  },
  {
    level: 5,
    id: "platinum",
    labelEn: "Platinum",
    labelRu: "Платина",
    labelVi: "Bạch kim",
    labelKo: "플래티넘",
    minKarma: 50_000,
  },
  {
    level: 6,
    id: "diamond",
    labelEn: "Diamond",
    labelRu: "Алмаз",
    labelVi: "Kim cương",
    labelKo: "다이아몬드",
    minKarma: 100_000,
  },
];

export type AgeBadgeTier = {
  level: number;
  id: string;
  years: number;
  labelEn: string;
  labelRu: string;
  labelVi: string;
  labelKo: string;
};

export const AGE_BADGE_TIERS: AgeBadgeTier[] = [
  {
    level: 1,
    id: "fresh",
    years: 0,
    labelEn: "Fresh",
    labelRu: "Свежий",
    labelVi: "Mới tham gia",
    labelKo: "새 회원",
  },
  {
    level: 2,
    id: "year1",
    years: 1,
    labelEn: "1 Year",
    labelRu: "1 год",
    labelVi: "1 năm",
    labelKo: "1년차",
  },
  {
    level: 3,
    id: "year2",
    years: 2,
    labelEn: "2 Years",
    labelRu: "2 года",
    labelVi: "2 năm",
    labelKo: "2년차",
  },
  {
    level: 4,
    id: "year3",
    years: 3,
    labelEn: "3 Years",
    labelRu: "3 года",
    labelVi: "3 năm",
    labelKo: "3년차",
  },
  {
    level: 5,
    id: "year5",
    years: 5,
    labelEn: "5 Years",
    labelRu: "5 лет",
    labelVi: "5 năm",
    labelKo: "5년차",
  },
  {
    level: 6,
    id: "year10",
    years: 10,
    labelEn: "10 Years",
    labelRu: "10 лет",
    labelVi: "10 năm",
    labelKo: "10년차",
  },
];

export function resolveKarmaBadge(karma: number): KarmaBadgeTier {
  let current = KARMA_BADGE_TIERS[0]!;
  for (const tier of KARMA_BADGE_TIERS) {
    if (karma >= tier.minKarma) current = tier;
  }
  return current;
}

export function resolveAgeBadge(createdAt: string | null | undefined): AgeBadgeTier {
  const days = accountAgeDays(createdAt);
  const years = Math.floor(days / 365);
  let current = AGE_BADGE_TIERS[0]!;
  for (const tier of AGE_BADGE_TIERS) {
    if (years >= tier.years) current = tier;
  }
  return current;
}

export type AccountBadge = {
  kind: "karma" | "age";
  id: string;
  level: number;
  label: string;
};

export function resolveAccountBadges(input: {
  karma?: number | null;
  createdAt?: string | null;
  locale?: Locale;
}): AccountBadge[] {
  const locale = input.locale ?? "vi";
  const karma = resolveKarmaBadge(input.karma ?? 0);
  const age = resolveAgeBadge(input.createdAt);
  return [
    {
      kind: "karma",
      id: karma.id,
      level: karma.level,
      label:
        locale === "ko"
          ? karma.labelKo
          : locale === "vi"
            ? karma.labelVi
            : karma.labelEn,
    },
    {
      kind: "age",
      id: age.id,
      level: age.level,
      label:
        locale === "ko"
          ? age.labelKo
          : locale === "vi"
            ? age.labelVi
            : age.labelEn,
    },
  ];
}
