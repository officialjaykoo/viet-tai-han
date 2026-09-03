"use client";

import type { ContentTranslation } from "@/lib/types";

export function shouldOfferTranslation(
  translation: ContentTranslation | null | undefined,
  locale: string
): boolean {
  if (!translation || translation.status !== "ready") return false;
  if (locale === "vi" || locale === "ko") return false;
  if (!translation.titleTranslated && !translation.bodyTranslated) {
    return false;
  }
  const source = translation.sourceLang;
  if (source !== "en" && source !== "ru") return false;
  return source !== locale;
}
