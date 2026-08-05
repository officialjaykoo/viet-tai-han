import { NextResponse } from "next/server";

import type { Locale } from "@/lib/i18n/config";
import { localizeErrorMessage } from "@/lib/i18n/errors";
import { getRequestLocale } from "@/lib/i18n/server";
import { AuthError } from "@/lib/session";

/** Map internal/technical errors to safe client-facing copy (localized). */
export function toPublicErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
  locale: Locale = "en"
): string {
  if (!(error instanceof AuthError) && !(error instanceof Error)) {
    return localizeErrorMessage(fallback, locale, fallback);
  }

  const message = error.message;
  if (message.length > 160 || message.includes("\n")) {
    return localizeErrorMessage(fallback, locale, fallback);
  }

  return localizeErrorMessage(message, locale, fallback);
}

export function jsonPublicError(
  error: unknown,
  fallback: string,
  status?: number,
  locale: Locale = "en"
): Response {
  if (error instanceof AuthError) {
    return Response.json(
      { error: toPublicErrorMessage(error, fallback, locale) },
      { status: error.status }
    );
  }
  return Response.json(
    { error: localizeErrorMessage(fallback, locale, fallback) },
    { status: status ?? 500 }
  );
}

export async function jsonLocalizedError(
  message: string,
  status: number
): Promise<NextResponse> {
  const { locale } = await getRequestLocale();
  return NextResponse.json(
    { error: localizeErrorMessage(message, locale) },
    { status }
  );
}
