import { redirect } from "next/navigation";

import { Feed } from "@/components/feed/feed";
import { SiteHeader } from "@/components/layout/site-header";
import { withFeedAds } from "@/lib/ads";
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
  const initialFeed: PaginatedFeed = await withFeedAds(
    {
      posts,
      nextCursor: null,
      hasMore: false,
    },
    session.user.id
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 safe-px safe-pb py-6 sm:py-8">
        <section className="mb-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {tLocale(locale, "pages.recommended")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tLocale(locale, "pages.recommendedBlurb")}
          </p>
        </section>
        <Feed initialFeed={initialFeed} />
      </main>
    </>
  );
}
