import {
  CircleHelpIcon,
  FlameIcon,
  HomeIcon,
  PlusIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StoreIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Feed } from "@/components/feed/feed";
import { FeedComposer } from "@/components/feed/feed-composer";
import { FeedShortcutRail } from "@/components/feed/feed-shortcut-rail";
import { FeedModeTabs, FeedSortTabs } from "@/components/feed/feed-controls";
import { SiteHeader } from "@/components/layout/site-header";
import { withFeedAds } from "@/lib/ads";
import { getFeedPosts, type FeedMode, type FeedSort } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { UserAvatar } from "@/components/user/user-avatar";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { PaginatedFeed } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseSort(value: string | undefined): FeedSort {
  if (value === "new" || value === "top" || value === "hot") return value;
  return "hot";
}

function parseMode(value: string | undefined): "home" | "popular" {
  if (value === "home") return "home";
  return "popular";
}

async function loadInitialFeed(options: {
  sort: FeedSort;
  mode: FeedMode;
  viewerUserId: string | null;
}): Promise<PaginatedFeed> {
  try {
    const feed = await getFeedPosts({
      limit: 20,
      viewerUserId: options.viewerUserId,
      sort: options.sort,
      mode: options.mode,
    });
    return await withFeedAds(feed, options.viewerUserId);
  } catch (error) {
    console.error("Failed to load initial feed", error);
    return { posts: [], nextCursor: null, hasMore: false };
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; feed?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const { locale } = await getRequestLocale();
  const signedIn = Boolean(session?.user);
  const username = (session?.user as { username?: string } | undefined)
    ?.username;
  const profileHref = username
    ? `/u/${encodeURIComponent(username)}`
    : "/login";
  const image = session?.user?.image ?? null;
  const desktopLinks = [
    { href: "/", label: tLocale(locale, "nav.popular"), icon: FlameIcon },
    { href: "/?feed=home", label: tLocale(locale, "nav.home"), icon: HomeIcon },
    {
      href: "/questions",
      label: tLocale(locale, "nav.questions"),
      icon: CircleHelpIcon,
    },
    {
      href: "/marketplace",
      label: tLocale(locale, "nav.marketplace"),
      icon: ShoppingBagIcon,
    },
    {
      href: "/communities",
      label: tLocale(locale, "nav.communities"),
      icon: UsersRoundIcon,
    },
    {
      href: "/businesses",
      label: tLocale(locale, "nav.businesses"),
      icon: StoreIcon,
    },
    {
      href: "/recommended",
      label: tLocale(locale, "nav.forYou"),
      icon: SparklesIcon,
    },
    {
      href: "/submit",
      label: tLocale(locale, "nav.createPost"),
      icon: PlusIcon,
    },
    {
      href: profileHref,
      label: tLocale(locale, "nav.profile"),
      icon: UserRoundIcon,
    },
  ];
  const shortcutLinks = [
    {
      href: "/communities",
      label: tLocale(locale, "nav.communities"),
      icon: UsersRoundIcon,
    },
    {
      href: "/questions",
      label: tLocale(locale, "nav.questions"),
      icon: CircleHelpIcon,
    },
    {
      href: "/marketplace",
      label: tLocale(locale, "nav.marketplace"),
      icon: ShoppingBagIcon,
    },
    {
      href: "/businesses",
      label: tLocale(locale, "nav.businesses"),
      icon: StoreIcon,
    },
  ];
  const sort = parseSort(params.sort);
  const mode = parseMode(params.feed);
  const initialFeed = await loadInitialFeed({
    sort,
    mode,
    viewerUserId: session?.user?.id ?? null,
  });

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="relative mx-auto grid w-full max-w-3xl safe-px safe-pb py-4 sm:py-6 xl:max-w-[1240px] xl:grid-cols-[228px_minmax(0,680px)_280px] xl:gap-5">
          <aside className="hidden xl:block">
            <nav
              className="sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] space-y-1 overflow-y-auto pr-2"
              aria-label={tLocale(locale, "nav.menu")}
            >
              <Link
                href={profileHref}
                className="mb-2 flex min-h-12 items-center gap-3 rounded-xl px-3 py-1.5 transition-colors hover:bg-card"
              >
                <UserAvatar
                  username={username}
                  image={image}
                  size="sm"
                  alt={username ? `@${username}` : tLocale(locale, "nav.logIn")}
                />
                <span className="truncate text-sm font-semibold">
                  {username ? `@${username}` : tLocale(locale, "nav.logIn")}
                </span>
              </Link>
              <div className="mb-2 h-px bg-border/70" />
              {desktopLinks.map(({ href, label, icon: Icon }, index) => {
                const active =
                  (index === 0 && mode === "popular") ||
                  (index === 1 && mode === "home");
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
                      active &&
                        "bg-[color-mix(in_oklch,var(--brand)_8%,transparent)] text-[var(--brand)]"
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 xl:col-start-2">
            <section className="mb-3 px-1 pt-1 sm:pt-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full bg-[var(--flag-gold)] ring-4 ring-[color-mix(in_oklch,var(--flag-gold)_22%,transparent)]"
                />
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                  {mode === "home"
                    ? tLocale(locale, "feed.yourFeed")
                    : tLocale(locale, "feed.popular")}
                </p>
              </div>
              <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Việt tại Hàn
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {mode === "home"
                  ? tLocale(locale, "feed.homeBlurb")
                  : tLocale(locale, "feed.popularBlurb")}
              </p>
            </section>

            <Suspense fallback={null}>
              <FeedModeTabs current={mode} signedIn={signedIn} />
              <FeedSortTabs current={sort} mode={mode} />
            </Suspense>

            <FeedComposer
              signedIn={signedIn}
              username={username}
              image={image}
              title={tLocale(locale, "nav.createPost")}
              prompt={tLocale(locale, "comments.placeholder")}
              textLabel={tLocale(locale, "questions.ask")}
              imageLabel={tLocale(locale, "post.image")}
              linkLabel={tLocale(locale, "post.link")}
            />
            <FeedShortcutRail
              heading={tLocale(locale, "nav.communities")}
              links={shortcutLinks}
            />
            <Feed initialFeed={initialFeed} sort={sort} mode={mode} />
          </div>

          <aside className="hidden xl:col-start-3 xl:block">
            <div className="sticky top-[4.5rem] space-y-4">
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_8%)]">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-[var(--flag-gold)]"
                />
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                  {tLocale(locale, "nav.communities")}
                </p>
              </div>
              <h2 className="mt-2 font-heading text-lg font-semibold">
                Việt tại Hàn
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {tLocale(locale, "meta.description")}
              </p>
              <Link
                href="/communities"
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[var(--brand)] px-3 text-sm font-semibold text-[var(--brand-foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--brand)_88%,black)]"
              >
                {tLocale(locale, "nav.communities")}
              </Link>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_8%)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {tLocale(locale, "nav.forYou")}
                </h2>
                <SparklesIcon
                  className="size-4 text-[var(--flag-gold)]"
                  aria-hidden
                />
              </div>
              <div className="mt-2 divide-y divide-border/70">
                {shortcutLinks.slice(0, 3).map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-11 items-center gap-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="size-4 text-[var(--brand)]" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_8%)]">
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                {tLocale(locale, "nav.questions")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tLocale(locale, "questions.blurb")}
              </p>
              <Link
                href="/questions"
                className="mt-3 inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[color-mix(in_oklch,var(--flag-gold)_18%,transparent)]"
              >
                {tLocale(locale, "questions.ask")}
              </Link>
            </section>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
