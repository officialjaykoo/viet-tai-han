"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { shouldOfferTranslation } from "@/components/content/translate-toggle";
import type { ContentTranslation } from "@/lib/types";

export function PostBodyPanel({
  body,
  translation,
}: {
  body: string;
  translation: ContentTranslation | null;
}) {
  const { t, locale } = useI18n();
  const [showTranslation, setShowTranslation] = useState(false);
  const offer = shouldOfferTranslation(translation, locale);
  const display =
    offer && showTranslation && translation?.bodyTranslated
      ? translation.bodyTranslated
      : body;

  return (
    <div className="space-y-2">
      <article className="rounded-2xl border border-border/60 bg-card/70 p-4 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {display}
      </article>
      {offer ? (
        <button
          type="button"
          className="text-xs font-medium text-[var(--brand)] hover:underline"
          aria-pressed={showTranslation}
          onClick={() => setShowTranslation((v) => !v)}
        >
          {showTranslation
            ? t("translate.showOriginal")
            : t("translate.action")}
        </button>
      ) : null}
    </div>
  );
}
