import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { PostStatsClient } from "@/components/posts/post-stats-client";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function PostStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const { locale } = await getRequestLocale();
  if (!session?.user) {
    redirect(`/login?next=/post/${id}/stats`);
  }
  await redirectIfIncompleteOnboarding(session.user.id);

  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, title, author_id FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(id)
    .first<{ id: string; title: string; author_id: string }>();

  if (!post) notFound();
  if (post.author_id !== session.user.id) {
    redirect(`/post/${id}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageShell width="narrow" className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/post/${id}`} className="hover:underline">
                {tLocale(locale, "post.backToPost")}
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              {tLocale(locale, "post.analytics")}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-balance">
              {post.title}
            </h1>
          </div>
          <PostStatsClient postId={id} />
        </PageShell>
      </main>
    </>
  );
}
