import { describe, expect, it } from "vitest";

import { shouldOfferTranslation } from "@/components/content/translate-toggle";
import {
  detectLanguageHeuristic,
  translationTargetFor,
} from "@/lib/translation";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  postEmbeddingText,
} from "@/lib/embeddings";

describe("multilingual content contracts", () => {
  it.each([
    ["Xin chào cộng đồng người Việt tại Hàn Quốc", "vi"],
    ["한국에서 베트남 사람들을 위한 커뮤니티", "ko"],
    ["This is a community post about housing", "en"],
    ["Это сообщение для сообщества", "ru"],
    ["123 !!!", "other"],
  ])("detects %s as %s", (text, expected) => {
    expect(detectLanguageHeuristic(text)).toBe(expected);
  });

  it.each([
    ["vi", "ko"],
    ["ko", "vi"],
    ["en", "vi"],
    ["ru", "vi"],
    ["other", null],
  ])("maps source %s to target %s", (source, expected) => {
    expect(translationTargetFor(source as Parameters<typeof translationTargetFor>[0])).toBe(
      expected
    );
  });

  it("only offers a ready translation to its target locale", () => {
    const translation = {
      sourceLang: "vi" as const,
      targetLang: "ko" as const,
      status: "ready" as const,
      titleTranslated: "베트남 커뮤니티",
      bodyTranslated: null,
    };

    expect(shouldOfferTranslation(translation, "ko")).toBe(true);
    expect(shouldOfferTranslation(translation, "vi")).toBe(false);
    expect(
      shouldOfferTranslation(
        { ...translation, targetLang: null },
        "ko"
      )
    ).toBe(true);
  });

  it("keeps post embedding text language-neutral", () => {
    const text = postEmbeddingText({
      subredditName: "cloudflare",
      title: "한국어 제목",
      body: "Nội dung tiếng Việt",
    });

    expect(text).toContain("Community: cloudflare");
    expect(text).toContain("한국어 제목");
    expect(text).toContain("Nội dung tiếng Việt");
    expect(text).not.toContain("r/cloudflare");
    expect(EMBEDDING_MODEL).toBe("@cf/google/embeddinggemma-300m");
    expect(EMBEDDING_DIMENSIONS).toBe(768);
    expect(EMBEDDING_VERSION).toBe("embeddinggemma-300m-v1");
  });
});
