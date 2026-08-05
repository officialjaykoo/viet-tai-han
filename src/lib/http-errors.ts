import { NextResponse } from "next/server";

import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/translate";

export type HttpErrorKind = "not_found" | "method_not_allowed";

/**
 * Paths that must never advertise themselves (no 405 / API hints).
 * Wrong methods and browser probes get a fake 404 instead.
 */
/** Internal app surface — never advertise with 405/JSON probes. */
export function isHiddenPath(pathname: string): boolean {
  return (
    pathname === "/i" ||
    pathname === "/i/api" ||
    pathname.startsWith("/i/")
  );
}

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return true;
  // Navigational fetches / address-bar visits often omit exotic accepts.
  const secFetch = request.headers.get("sec-fetch-dest");
  if (secFetch === "document") return true;
  return false;
}

function errorCopy(locale: Locale, kind: HttpErrorKind) {
  const m = getMessages(locale).errors;
  if (kind === "method_not_allowed") {
    return {
      code: m.code405,
      title: m.methodNotAllowedTitle,
      body: m.methodNotAllowedBody,
      home: m.goHome,
    };
  }
  return {
    code: m.code404,
    title: m.notFoundTitle,
    body: m.notFoundBody,
    home: m.goHome,
  };
}

/** Standalone HTML that matches the branded ErrorScreen look. */
export function renderErrorHtml(
  kind: HttpErrorKind,
  locale: Locale = "en"
): string {
  const copy = errorCopy(locale, kind);
  const lang = locale === "ru" ? "ru" : "en";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
  <title>${copy.code} · red</title>
  <style>
    :root {
      --background: #faf9f7;
      --foreground: #1c1917;
      --muted: #78716c;
      --brand: #ea580c;
      --brand-foreground: #fff7ed;
      --font: "Manrope", ui-sans-serif, system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #2a2622;
        --foreground: #f5f5f4;
        --muted: #a8a29e;
        --brand: #fb923c;
        --brand-foreground: #1c1917;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6rem 1.5rem;
      font-family: var(--font);
      background: var(--background);
      color: var(--foreground);
      background-image: radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--brand) 18%, transparent), transparent 55%);
    }
    .code {
      margin: 0;
      font-size: clamp(4rem, 12vw, 6rem);
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--brand);
      line-height: 1;
    }
    h1 {
      margin: 1rem 0 0;
      font-size: clamp(1.4rem, 3vw, 1.85rem);
      font-weight: 600;
      letter-spacing: -0.02em;
      text-wrap: balance;
      text-align: center;
    }
    p {
      margin: 0.75rem 0 0;
      max-width: 28rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }
    a {
      margin-top: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.5rem;
      padding: 0 1.25rem;
      border-radius: 999px;
      background: var(--brand);
      color: var(--brand-foreground);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
    }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <p class="code">${copy.code}</p>
  <h1>${copy.title}</h1>
  <p>${copy.body}</p>
  <a href="/">${copy.home}</a>
</body>
</html>`;
}

export function htmlErrorResponse(
  kind: HttpErrorKind,
  options?: { locale?: Locale; status?: number }
): NextResponse {
  const status =
    options?.status ?? (kind === "method_not_allowed" ? 405 : 404);
  return new NextResponse(renderErrorHtml(kind, options?.locale ?? "en"), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Always looks like a normal 404 — used for hidden internal paths. */
export function fakeNotFoundResponse(options?: {
  locale?: Locale;
}): NextResponse {
  return htmlErrorResponse("not_found", {
    locale: options?.locale,
    status: 404,
  });
}

export function htmlErrorIfBrowser(
  request: Request,
  kind: HttpErrorKind,
  options?: { locale?: Locale; status?: number }
): NextResponse | null {
  if (!wantsHtml(request)) return null;
  return htmlErrorResponse(kind, options);
}
