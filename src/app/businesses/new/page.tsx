import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessForm } from "@/components/business/business-form";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/businesses/new")}`);
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="compact" className="space-y-6">
          <Link href="/businesses" className="text-sm font-medium text-[var(--brand)] hover:underline">
            ← {tLocale(locale, "business.titlePage")}
          </Link>
          <PageHero
            eyebrow={tLocale(locale, "business.eyebrow")}
            title={tLocale(locale, "business.createProfile")}
            description={tLocale(locale, "business.blurb")}
          />
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <BusinessForm />
          </div>
        </PageShell>
      </main>
    </>
  );
}
