import { describe, expect, it } from "vitest";

import {
  detectLocaleFromAcceptLanguage,
  detectLocaleFromCountry,
  LOCALES,
  resolveLocale,
} from "@/lib/i18n/config";
import { localizeErrorMessage } from "@/lib/i18n/errors";

describe("request locale detection", () => {
  it("supports the four UI locales", () => {
    expect(LOCALES).toEqual(["vi", "ko", "en", "ru"]);
  });

  it.each([
    ["ko-KR,ko;q=0.9,en;q=0.8", "ko"],
    ["vi-VN, en;q=0.8", "vi"],
    ["ru-RU;q=0.7,en;q=0.9", "en"],
    ["zh-CN,ja;q=0.9", null],
    [null, null],
  ])("detects the best browser locale from %s", (header, expected) => {
    expect(detectLocaleFromAcceptLanguage(header)).toBe(expected);
  });

  it.each([
    ["VN", "vi"],
    ["kr", "ko"],
    ["RU", "ru"],
    ["US", null],
  ])("uses Cloudflare country %s as a fallback", (country, expected) => {
    expect(detectLocaleFromCountry(country)).toBe(expected);
  });

  it("keeps explicit choices ahead of automatic detection", () => {
    expect(
      resolveLocale({
        cookieLocale: "ru",
        preferredLanguage: "ko",
        acceptLanguage: "vi",
        countryCode: "VN",
      })
    ).toBe("ru");
    expect(
      resolveLocale({
        preferredLanguage: "ko",
        acceptLanguage: "vi",
        countryCode: "VN",
      })
    ).toBe("ko");
    expect(
      resolveLocale({ acceptLanguage: "vi", countryCode: "KR" })
    ).toBe("vi");
    expect(resolveLocale({ countryCode: "KR" })).toBe("ko");
    expect(resolveLocale({ countryCode: "XX" })).toBe("en");
  });

  it("explains Kakao auth errors in the selected UI language", () => {
    expect(localizeErrorMessage("KOE004", "ko")).toContain(
      "카카오 로그인"
    );
    expect(localizeErrorMessage("KOE004", "en")).toContain(
      "Kakao Login is not enabled"
    );
    expect(localizeErrorMessage("KOE205", "ko")).toContain(
      "닉네임과 프로필 사진"
    );
    expect(localizeErrorMessage("KOE205", "en")).toContain(
      "nickname and profile image"
    );
  });
  it("keeps DM request failures actionable in Korean and Vietnamese", () => {
    expect(
      localizeErrorMessage(
        "Your karma is too low to send messages. Participate more first.",
        "ko"
      )
    ).toBe("메시지를 보내려면 카르마가 필요합니다. 먼저 더 활동해 주세요.");
    expect(
      localizeErrorMessage("This user isn't accepting chat requests", "vi")
    ).toBe("Người dùng này không nhận yêu cầu trò chuyện");
    expect(
      localizeErrorMessage("A chat request is already pending", "ko")
    ).toBe("대화 요청이 이미 처리 대기 중입니다");
    expect(localizeErrorMessage("Chat already exists", "vi")).toBe(
      "Cuộc trò chuyện đã tồn tại"
    );
    expect(
      localizeErrorMessage("You're doing that too often. Try again later.", "ko")
    ).toBe("요청이 너무 많습니다. 나중에 다시 시도해 주세요.");
    expect(localizeErrorMessage("You can't message this user", "ko")).toBe(
      "이 사용자에게 메시지를 보낼 수 없습니다"
    );
  });

});
