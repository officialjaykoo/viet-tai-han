import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessForm } from "@/components/business/business-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/businesses/new")}`);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="relative mx-auto w-full max-w-3xl space-y-6 safe-px safe-pb py-6 sm:py-8">
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
        </div>
      </main>
    </>
  );
}
