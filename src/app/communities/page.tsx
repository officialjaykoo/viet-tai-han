import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
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
      <main className="flex-1">
        <PageShell width="standard" className="space-y-10">
        <section>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {tLocale(locale, "communities.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tLocale(locale, "communities.browseBlurb")}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">
            {tLocale(locale, "communities.directory")}
          </h2>
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
        </section>
        </PageShell>
      </main>
    </>
  );
}
