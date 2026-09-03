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
import type { Locale } from "@/lib/i18n/config";

const TITLE_I18N: Partial<Record<string, { vi: string; ko: string }>> = {
  poster: { vi: "Người viết bài", ko: "글 작성자" },
  commenter: { vi: "Người bình luận", ko: "댓글 작성자" },
  karma_climber: { vi: "Người xây dựng uy tín", ko: "신뢰 점수 성장" },
  community_leader: { vi: "Người dẫn dắt cộng đồng", ko: "커뮤니티 리더" },
  follower_magnet: { vi: "Thu hút người theo dõi", ko: "팔로워 인기" },
  social_butterfly: { vi: "Kết nối xã hội", ko: "소셜 활동가" },
  popular_post: { vi: "Được yêu thích", ko: "인기 글" },
  voter: { vi: "Người bình chọn", ko: "투표 참여자" },
  cake_day: { vi: "Ngày tham gia", ko: "가입 기념일" },
  conversationalist: { vi: "Người trò chuyện", ko: "대화 전문가" },
  link_poster: { vi: "Chia sẻ đường dẫn", ko: "링크 공유자" },
  media_maven: { vi: "Chia sẻ hình ảnh", ko: "미디어 전문가" },
  welcome: { vi: "Chào mừng", ko: "환영" },
  busy_bee: { vi: "Chăm chỉ", ko: "부지런한 참여자" },
  laefye: { vi: "laefye", ko: "laefye" },
  first_post: { vi: "Bài đăng đầu tiên", ko: "첫 글" },
  first_comment: { vi: "Bình luận đầu tiên", ko: "첫 댓글" },
  community_builder: { vi: "Người xây dựng cộng đồng", ko: "커뮤니티 개척자" },
  badge_karma: { vi: "Huy hiệu uy tín", ko: "신뢰 점수 배지" },
  badge_age: { vi: "Thành viên từ ngày", ko: "가입 기념" },
  admin: { vi: "Quản trị viên", ko: "관리자" },
  moderator: { vi: "Điều phối viên", ko: "운영자" },
  veteran: { vi: "Thành viên kỳ cựu", ko: "베테랑 회원" },
  nsfw: { vi: "Nội dung nhạy cảm", ko: "민감 콘텐츠" },
  karma_100: { vi: "100 điểm uy tín", ko: "신뢰 점수 100" },
  karma_1000: { vi: "1.000 điểm uy tín", ko: "신뢰 점수 1,000" },
};

const DESCRIPTION_I18N: Partial<Record<string, { vi: string; ko: string }>> = {
  admin: { vi: "Quản trị viên của trang", ko: "사이트 관리자" },
  moderator: {
    vi: "Điều phối viên cộng đồng hoặc trang",
    ko: "커뮤니티 또는 사이트 운영자",
  },
  veteran: {
    vi: "Thành viên lâu năm của Việt tại Hàn",
    ko: "Việt tại Hàn의 오래된 회원",
  },
  nsfw: { vi: "Hồ sơ được đánh dấu nhạy cảm", ko: "프로필이 민감 콘텐츠로 표시됨" },
  first_post: { vi: "Đăng bài đầu tiên", ko: "첫 글을 작성하세요" },
  first_comment: { vi: "Để lại bình luận đầu tiên", ko: "첫 댓글을 남기세요" },
  karma_100: { vi: "Đạt 100 điểm uy tín", ko: "신뢰 점수 100 달성" },
  karma_1000: { vi: "Đạt 1.000 điểm uy tín", ko: "신뢰 점수 1,000 달성" },
  community_builder: { vi: "Tạo một cộng đồng", ko: "커뮤니티를 만들어 보세요" },
  poster: {
    vi: "Đăng bài để tăng cấp thành tích",
    ko: "글을 작성해 업적 레벨을 올리세요",
  },
  commenter: {
    vi: "Để lại bình luận để tăng cấp thành tích",
    ko: "댓글을 남겨 업적 레벨을 올리세요",
  },
  karma_climber: {
    vi: "Tăng điểm uy tín trên toàn trang",
    ko: "사이트에서 신뢰 점수를 쌓으세요",
  },
  community_leader: {
    vi: "Tạo các cộng đồng",
    ko: "커뮤니티를 만들어 보세요",
  },
  follower_magnet: {
    vi: "Thu hút người theo dõi trên trang cá nhân",
    ko: "프로필에서 팔로워를 늘리세요",
  },
  social_butterfly: {
    vi: "Theo dõi những thành viên khác",
    ko: "다른 회원을 팔로우하세요",
  },
  popular_post: {
    vi: "Đưa một bài đăng đạt điểm cao",
    ko: "글을 높은 점수까지 올려 보세요",
  },
  voter: {
    vi: "Bình chọn trên toàn trang",
    ko: "사이트의 글에 투표하세요",
  },
  cake_day: {
    vi: "Kỷ niệm thêm một năm tại Việt tại Hàn",
    ko: "Việt tại Hàn 가입 기념일을 축하하세요",
  },
  conversationalist: {
    vi: "Nhận phản hồi cho bình luận của bạn",
    ko: "댓글에 답글을 받아 보세요",
  },
  link_poster: {
    vi: "Chia sẻ bài đăng có đường dẫn",
    ko: "링크 글을 공유하세요",
  },
  media_maven: {
    vi: "Chia sẻ bài đăng có hình ảnh",
    ko: "이미지 글을 공유하세요",
  },
  welcome: {
    vi: "Tạo tài khoản tại Việt tại Hàn",
    ko: "Việt tại Hàn 계정을 만들었습니다",
  },
  busy_bee: {
    vi: "Đăng bài và bình luận trong cùng một ngày",
    ko: "같은 날 글과 댓글을 작성하세요",
  },
  laefye: {
    vi: "Nhắc đến laefye trong bài đăng hoặc bình luận",
    ko: "글이나 댓글에서 laefye를 언급하세요",
  },
  badge_karma: {
    vi: "Huy hiệu xếp hạng dựa trên tổng điểm uy tín",
    ko: "총 신뢰 점수에 따른 등급 배지",
  },
  badge_age: {
    vi: "Huy hiệu dựa trên thời gian tham gia",
    ko: "가입 기간에 따른 배지",
  },
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
        {locale === "ko" ? "아직 업적이 없습니다." : "Chưa có thành tích."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {badges.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {locale === "ko" ? "배지" : "Huy hiệu"}
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
  locale: Locale;
  highlight?: boolean;
}) {
  const i18n = TITLE_I18N[item.slug];
  const title = i18n?.[locale] ?? item.title;
  const description = DESCRIPTION_I18N[item.slug]?.[locale] ?? item.description;
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
            {description}
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
              {locale === "ko" ? "다음 레벨:" : "Cấp tiếp theo:"} {next}
            </p>
          ) : (
            <p className="mt-1 text-[10px] font-medium text-[var(--brand)]">
              {locale === "ko" ? "최고 레벨" : "Cấp tối đa"}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
