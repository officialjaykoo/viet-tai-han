import { Suspense } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { MessagesClient } from "@/components/messages/messages-client";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { tLocale } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <PageShell width="wide" className="space-y-6">
          <section>
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "messages.inbox")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "messages.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tLocale(locale, "messages.description")}
            </p>
          </section>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                {tLocale(locale, "common.loading")}
              </p>
            }
          >
            <MessagesClient />
          </Suspense>
        </PageShell>
      </main>
    </>
  );
}
