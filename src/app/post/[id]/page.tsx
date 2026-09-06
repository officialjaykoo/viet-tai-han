import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/ads/ad-slot";
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentThread } from "@/components/comments/comment-thread";
import { SiteHeader } from "@/components/layout/site-header";
import { PostCard } from "@/components/feed/post-card";
import { TunneledOutboundLink } from "@/components/media/tunneled-outbound-link";
import { PostAuthorActions } from "@/components/posts/post-author-actions";
import { PostBodyPanel } from "@/components/posts/post-body-panel";
import { PostViewBeacon } from "@/components/posts/post-view-beacon";
import { SubredditLabel } from "@/components/posts/subreddit-label";
import { getPostDetail } from "@/lib/content";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { parseDiscoverySource } from "@/lib/vote-weight";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { id } = await params;
  const { src } = await searchParams;
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const post = await getPostDetail(id, session?.user?.id ?? null);
  if (!post) notFound();
  const discoverySource = parseDiscoverySource(src);

  return (
    <>
      <SiteHeader />
      <PostViewBeacon postId={post.id} discoverySource={discoverySource} />
      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-6 safe-px safe-pb py-6 sm:py-8">
          <p className="text-sm text-muted-foreground">
            <SubredditLabel name={post.subreddit.name} />
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            <Link
              href={`/u/${post.author.username}`}
              prefetch={false}
              className="hover:underline"
            >
              @{post.author.username}
            </Link>
          </p>

          <PostCard post={post} />

          <PostAuthorActions
            postId={post.id}
            isOwner={Boolean(post.author.isAuthor)}
            initialTitle={post.title}
            initialBody={post.body}
          />

          <AdSlot placement="post_footer" />

          {post.url ? (
            <p className="text-sm">
              <TunneledOutboundLink
                href={`/api/posts/${post.id}/out`}
                className="text-[var(--brand)] hover:underline"
              >
                {post.url}
              </TunneledOutboundLink>
            </p>
          ) : null}

          {post.body ? (
            <PostBodyPanel body={post.body} translation={post.translation} />
          ) : null}

          <section className="space-y-4">
            <h2 className="font-heading text-xl font-semibold">
              {tLocale(locale, "pages.comments")}
            </h2>
            {post.isLocked ? (
              <p className="text-sm text-muted-foreground">
                {tLocale(locale, "pages.postLocked")}
              </p>
            ) : (
              <CommentComposer postId={post.id} />
            )}
            <CommentThread
              comments={post.comments}
              postId={post.id}
              viewerId={session?.user?.id ?? null}
            />
          </section>
        </div>
      </main>
    </>
  );
}
