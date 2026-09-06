import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessForm } from "@/components/business/business-form";
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
        <PageShell width="narrow" className="space-y-6">
          <Link href="/businesses" className="text-sm font-medium text-[var(--brand)] hover:underline">
            ← {tLocale(locale, "business.titlePage")}
          </Link>
          <section>
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "business.eyebrow")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "business.createProfile")}
            </h1>
          </section>
          <BusinessForm />
        </PageShell>
      </main>
    </>
  );
}
