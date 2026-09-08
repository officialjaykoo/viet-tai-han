import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSubredditByName } from "@/lib/content";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import {
  isProfileCommunityName,
  profileCommunityName,
} from "@/lib/profile-community";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
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
  await redirectIfIncompleteOnboarding(session.user.id);
  let defaultSubreddit = name;
  if (isProfileCommunityName(name)) {
    const currentUser = session.user as {
      username?: string | null;
      name?: string | null;
    };
    const currentUsername = currentUser.username ?? currentUser.name;
    let ownsProfileCommunity = false;
    if (currentUsername) {
      try {
        ownsProfileCommunity =
          profileCommunityName(currentUsername).toLowerCase() ===
          name.toLowerCase();
      } catch {
        ownsProfileCommunity = false;
      }
    }
    if (!ownsProfileCommunity) {
      notFound();
    }
    const existingProfile = await getSubredditByName(name);
    if (
      existingProfile &&
      (existingProfile.is_removed ||
        existingProfile.created_by !== session.user.id)
    ) {
      notFound();
    }
    // Resolve internal profile targets through the canonical current-user path.
    defaultSubreddit = "profile";
  }

  const { locale } = await getRequestLocale();
  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <PageShell width="narrow">
          <section className="mb-6">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "post.submitTitle")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {name}
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {tLocale(locale, "communities.submitBlurb")}
            </p>
          </section>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <CreatePostForm defaultSubreddit={defaultSubreddit} />
          </div>
        </PageShell>
      </main>
    </>
  );
}
