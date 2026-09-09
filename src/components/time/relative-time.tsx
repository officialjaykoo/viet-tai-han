"use client";

import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatAbsoluteDate, formatRelativeTime } from "@/lib/format-time";

export function RelativeTime({ value }: { value: string }) {
  const { locale } = useI18n();
  const [label, setLabel] = useState(() => formatAbsoluteDate(value, locale));
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      setLabel(formatRelativeTime(value, Date.now(), locale));
    });
    const id = window.setInterval(() => {
      setLabel(formatRelativeTime(value, Date.now(), locale));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [value, locale, startTransition]);

  return <time dateTime={value}>{label}</time>;
}
