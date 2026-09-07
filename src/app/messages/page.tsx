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
        <PageShell width="wide" className="py-3 sm:py-4">
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
