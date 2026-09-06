import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingSaveButton } from "@/components/marketplace/listing-save-button";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { formatListingPrice, listSavedListings } from "@/lib/marketplace";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function SavedMarketplaceListingsPage() {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/marketplace/saved")}`);
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();
  const listings = await listSavedListings(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageShell width="standard" className="space-y-6">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "marketplace.backToMarketplace")}
          </Link>
          <section>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {tLocale(locale, "marketplace.savedListings")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tLocale(locale, "marketplace.blurb")}
            </p>
          </section>
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              {tLocale(locale, "marketplace.noSaved")}
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <article className="h-full rounded-2xl border border-border/60 bg-card/75 p-4 shadow-sm sm:p-5">
                    <Link href={`/marketplace/${listing.id}`} className="block">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{listing.category}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{listing.location}</span>
                      </div>
                      <h2 className="mt-2 font-heading text-lg font-semibold leading-snug hover:text-[var(--brand)]">
                        {listing.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {listing.body}
                      </p>
                    </Link>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <UserAvatar
                          username={listing.seller.username}
                          image={listing.seller.image}
                          size="xs"
                          className="ring-0"
                        />
                        <span className="truncate">
                          @{listing.seller.username ?? "unknown"}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatListingPrice(listing.price) ??
                          tLocale(locale, "marketplace.noPrice")}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ListingSaveButton
                        listingId={listing.id}
                        initialSaved
                        authenticated
                      />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </PageShell>
      </main>
    </>
  );
}
