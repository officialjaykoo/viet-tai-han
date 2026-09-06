import Link from "next/link";
import { redirect } from "next/navigation";

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
        <div className="relative mx-auto w-full max-w-4xl space-y-6 safe-px safe-pb py-6 sm:py-8">
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
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              {tLocale(locale, "business.emptyMine")}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {businesses.map((business) => (
                <li key={business.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{business.category}</span>
                    <span aria-hidden>·</span>
                    <span>{tLocale(locale, verificationKey(business.verificationStatus))}</span>
                    <span aria-hidden>·</span>
                    <span>{tLocale(locale, business.status === "paused" ? "business.paused" : "business.active")}</span>
                  </div>
                  <h2 className="mt-2 font-heading text-lg font-semibold">{business.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{business.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/businesses/${business.slug}`}
                      className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
                    >
                      {tLocale(locale, "business.manage")}
                    </Link>
                    <Link
                      href={`/businesses/${business.slug}/edit`}
                      className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      {tLocale(locale, "business.edit")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
