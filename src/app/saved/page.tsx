import { redirect } from "next/navigation";

import { PostCard } from "@/components/feed/post-card";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { listSavedPosts } from "@/lib/post-saves";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SavedPostsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/saved");
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();
  const posts = await listSavedPosts(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop variant="subtle" />
        <PageShell width="standard" className="space-y-8">
          <PageHero
            eyebrow={tLocale(locale, "saved.eyebrow")}
            title={tLocale(locale, "saved.title")}
            description={tLocale(locale, "saved.description")}
          />
          {posts.length === 0 ? (
            <EmptyState>{tLocale(locale, "saved.empty")}</EmptyState>
          ) : (
            <div className="mx-auto w-full max-w-2xl space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} discoverySource="shared" />
              ))}
            </div>
          )}
        </PageShell>
      </main>
    </>
  );
}
