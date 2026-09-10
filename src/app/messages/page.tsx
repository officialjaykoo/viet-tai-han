import { Suspense } from "react";
import { redirect } from "next/navigation";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { MessagesClient } from "@/components/messages/messages-client";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { tLocale } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    const { to } = await searchParams;
    const next = to ? `/messages?to=${encodeURIComponent(to)}` : "/messages";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main data-testid="messages-page" className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="py-3 sm:py-4">
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
