"use client";

import { useCallback } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { localizeErrorMessage } from "@/lib/i18n/errors";

/** Localize API / AuthError English messages for the active UI locale. */
export function useLocalizedError() {
  const { locale } = useI18n();
  return useCallback(
    (message: string | null | undefined, fallback?: string) => {
      if (!message) {
        return localizeErrorMessage(
          fallback ?? "Something went wrong",
          locale,
          fallback
        );
      }
      return localizeErrorMessage(message, locale, fallback);
    },
    [locale]
  );
}
