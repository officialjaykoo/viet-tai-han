import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BusinessForm } from "@/components/business/business-form";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getBusinessDetail } from "@/lib/businesses";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function EditBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/businesses/${id}/edit`)}`);
  }
  await redirectIfIncompleteOnboarding(session.user.id);
  const business = await getBusinessDetail(id, session.user.id);
  if (!business || !business.owner.isOwner) notFound();
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="narrow" className="space-y-6">
          <Link
            href={`/businesses/${business.slug}`}
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {business.name}
          </Link>
          <PageHero
            eyebrow={tLocale(locale, "business.eyebrow")}
            title={tLocale(locale, "business.edit")}
            description={business.name}
          />
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <BusinessForm initial={business} />
          </div>
        </PageShell>
      </main>
    </>
  );
}
