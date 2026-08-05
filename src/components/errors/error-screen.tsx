import Link from "next/link";

import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";

type ErrorScreenProps = {
  /** Visible status label (404 or 405). Fake 404s for hidden paths still use 404. */
  code: "404" | "405";
};

/**
 * Branded full-page error used by not-found and method-not-allowed surfaces.
 */
export async function ErrorScreen({ code }: ErrorScreenProps) {
  const { locale } = await getRequestLocale();
  const title =
    code === "405"
      ? tLocale(locale, "errors.methodNotAllowedTitle")
      : tLocale(locale, "errors.notFoundTitle");
  const body =
    code === "405"
      ? tLocale(locale, "errors.methodNotAllowedBody")
      : tLocale(locale, "errors.notFoundBody");
  const codeLabel =
    code === "405"
      ? tLocale(locale, "errors.code405")
      : tLocale(locale, "errors.code404");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_55%)]"
      />
      <p className="font-heading text-7xl font-bold tracking-tight text-[var(--brand)] sm:text-8xl">
        {codeLabel}
      </p>
      <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-muted-foreground sm:text-base">
        {body}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-foreground)] transition-opacity hover:opacity-90"
      >
        {tLocale(locale, "errors.goHome")}
      </Link>
    </main>
  );
}
