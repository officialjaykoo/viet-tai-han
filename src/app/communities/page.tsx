import Link from "next/link";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/layout/site-header";
import { listSubreddits } from "@/lib/content";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { tLocale } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const communities = await listSubreddits(100);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop />
        <PageShell width="standard" className="space-y-8">
          <PageHero
            eyebrow={tLocale(locale, "communities.directory")}
            title={tLocale(locale, "communities.title")}
            description={tLocale(locale, "communities.browseBlurb")}
          />

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">
            {tLocale(locale, "communities.directory")}
          </h2>
          {communities.length === 0 ? (
            <EmptyState>{tLocale(locale, "communities.empty")}</EmptyState>
          ) : (
            <ul className="space-y-2">
              {communities.map((community) => (
                <li key={community.id}>
                  <Link
                    href={`/r/${community.name}`}
                    className="block rounded-2xl border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="font-medium">{community.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {community.title}
                      {community.subscriberCount != null
                        ? ` · ${community.subscriberCount} ${tLocale(locale, "communities.members")}`
                        : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        </PageShell>
      </main>
    </>
  );
}
