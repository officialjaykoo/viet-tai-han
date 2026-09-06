import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
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
        <PageShell width="standard" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/businesses" className="text-sm font-medium text-[var(--brand)] hover:underline">
              ← {tLocale(locale, "business.titlePage")}
            </Link>
            <Link
              href="/businesses/new"
              className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              {tLocale(locale, "business.createProfile")}
            </Link>
          </div>
          <section>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "business.myBusinesses")}
            </h1>
          </section>
          {businesses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              {tLocale(locale, "business.emptyMine")}
            </p>
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
