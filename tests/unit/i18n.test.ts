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
});
