import { redirect } from "next/navigation";

import { Feed } from "@/components/feed/feed";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRecommendations } from "@/lib/content";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import type { PaginatedFeed } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecommendedPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/recommended");
  }
  await redirectIfIncompleteOnboarding(session.user.id);

  const { locale } = await getRequestLocale();
  const posts = await getRecommendations(session.user.id, 20);
  const initialFeed: PaginatedFeed = {
    posts: posts.map((post) => ({ ...post, kind: "post" as const })),
    nextCursor: null,
    hasMore: false,
  };

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "nav.forYou")}
            title={tLocale(locale, "pages.recommended")}
            description={tLocale(locale, "pages.recommendedBlurb")}
          />
          <Feed initialFeed={initialFeed} />
        </PageShell>
      </main>
    </>
  );
}
