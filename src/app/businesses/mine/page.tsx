import Link from "next/link";
import { redirect } from "next/navigation";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listOwnedBusinesses } from "@/lib/businesses";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

function verificationKey(status: string) {
  if (status === "verified") return "business.verified";
  if (status === "pending") return "business.pending";
  if (status === "rejected") return "business.rejected";
  return "business.unverified";
}

export default async function MyBusinessesPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/businesses/mine")}`);
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();
  const businesses = await listOwnedBusinesses(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "business.eyebrow")}
            title={tLocale(locale, "business.myBusinesses")}
            actions={
              <Link
                href="/businesses/new"
                className={buttonVariants({ size: "sm" })}
              >
                {tLocale(locale, "business.createProfile")}
              </Link>
            }
          />
          {businesses.length === 0 ? (
            <EmptyState>{tLocale(locale, "business.emptyMine")}</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {businesses.map((business) => (
                <li key={business.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{business.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{business.address}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{tLocale(locale, verificationKey(business.verificationStatus))}</span>
                  </div>
                  <Link className="mt-4 inline-flex text-sm font-medium text-[var(--brand)] hover:underline" href={`/businesses/${business.slug}`}>
                    {tLocale(locale, "common.edit")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageShell>
      </main>
    </>
  );
}
