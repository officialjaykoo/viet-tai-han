"use client";

import type { ContentTranslation } from "@/lib/types";

export function shouldOfferTranslation(
  translation: ContentTranslation | null | undefined,
  locale: string
): boolean {
  if (!translation || translation.status !== "ready") return false;
  if (locale !== "vi" && locale !== "ko") return false;
  if (!translation.titleTranslated && !translation.bodyTranslated) {
    return false;
  }

  const source = translation.sourceLang;
  if (!source || source === "other" || source === locale) return false;

  // Rows created before translation_target_lang can still be displayed when
  // they follow the original vi↔ko pairing.
  const inferredTarget =
    source === "vi" ? "ko" : source === "ko" ? "vi" : null;
  const target = translation.targetLang ?? inferredTarget;
  return target === locale;
}
