import { redirect } from "next/navigation";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { CreatePostForm } from "@/components/posts/create-post-form";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { tLocale } from "@/lib/i18n/translate";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const defaultPostType =
    type === "image" ? "image" : type === "link" ? "link" : "text";
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(`/submit?type=${defaultPostType}`)}`);
  }
  await redirectIfIncompleteOnboarding(session.user.id);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop />
        <PageShell width="narrow" className="space-y-6">
          <PageHero
            eyebrow={tLocale(locale, "pages.compose")}
            title={tLocale(locale, "post.submitTitle")}
            description={tLocale(locale, "pages.submitBlurb")}
          />

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <CreatePostForm defaultPostType={defaultPostType} />
          </div>
        </PageShell>
      </main>
    </>
  );
}
