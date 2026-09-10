import { redirect } from "next/navigation";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { CreatePostForm } from "@/components/posts/create-post-form";

export const dynamic = "force-dynamic";

export default async function SubmitInSubredditPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(`/r/${name}/submit`)}`);
  }
  const defaultSubreddit = name;

  const { locale } = await getRequestLocale();
  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop />
        <PageShell width="compact" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "post.submitTitle")}
            title={name}
            description={tLocale(locale, "communities.submitBlurb")}
          />

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <CreatePostForm defaultSubreddit={defaultSubreddit} />
          </div>
        </PageShell>
      </main>
    </>
  );
}
