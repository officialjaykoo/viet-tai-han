import { SiteHeader } from "@/components/layout/site-header";
import { CreatePostForm } from "@/components/posts/create-post-form";

export const dynamic = "force-dynamic";

export default async function SubmitInSubredditPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl safe-px safe-pb py-6 sm:py-8">
          <section className="mb-6">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              Compose
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Post in r/{name}
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Share something with this community.
            </p>
          </section>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <CreatePostForm defaultSubreddit={name} />
          </div>
        </div>
      </main>
    </>
  );
}
