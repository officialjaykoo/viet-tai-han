import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { en, type MessageKey, type Messages } from "@/lib/i18n/messages/en";
import { ko } from "@/lib/i18n/messages/ko";
import { ru } from "@/lib/i18n/messages/ru";
import { vi } from "@/lib/i18n/messages/vi";

const catalogs: Record<Locale, Messages> = { vi, ko, en, ru };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}

export function translate(
  messages: Messages,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const [ns, name] = key.split(".") as [keyof Messages, string];
  const group = messages[ns] as Record<string, string> | undefined;
  let text = group?.[name] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function tLocale(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  return translate(getMessages(locale), key, params);
}
