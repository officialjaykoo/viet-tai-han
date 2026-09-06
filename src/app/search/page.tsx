import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { SearchForm } from "@/components/search/search-form";
import { AccountTags } from "@/components/user/account-tags";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { tLocale } from "@/lib/i18n/translate";
import { formatListingPrice } from "@/lib/marketplace";
import { normalizeSearchQuery, searchAll } from "@/lib/search";

function listingPriceSuffix(value: string | null): string {
  const formatted = formatListingPrice(value);
  return formatted ? ` · ${formatted}` : "";
}

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q ?? "");
  const results = query ? await searchAll(query) : null;
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl space-y-8 safe-px safe-pb py-6 sm:py-8">
          <section>
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "search.title")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
              {query ? (
                <>
                  {tLocale(locale, "pages.searchResultsFor")}{" "}
                  <span className="text-[var(--brand)]">“{query}”</span>
                </>
              ) : (
                tLocale(locale, "pages.findBlurb")
              )}
            </h1>
            <div className="mt-5 max-w-xl">
              <SearchForm initialQuery={query} autoFocus={!query} />
            </div>
          </section>

          {query && results ? (
            <div className="space-y-10">
              <SearchSection
                title={tLocale(locale, "search.communities")}
                empty={tLocale(locale, "pages.noCommunitiesMatched")}
                count={results.communities.length}
              >
                <ul className="space-y-2">
                  {results.communities.map((community) => (
                    <li key={community.name}>
                      <Link
                        href={`/r/${community.name}`}
                        className="block rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <p className="font-medium">{community.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {community.title} ·{" "}
                          {tLocale(locale, "search.membersCount", {
                            count: community.subscriberCount.toLocaleString(
                              locale
                            ),
                          })}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SearchSection>

              <SearchSection
                title={tLocale(locale, "search.accounts")}
                empty={tLocale(locale, "pages.noAccountsMatched")}
                count={results.accounts.length}
              >
                <ul className="space-y-2">
                  {results.accounts.map((account) => (
                    <li key={account.username}>
                      <Link
                        href={`/u/${account.username}`}
                        prefetch={false}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <UserAvatar
                          username={account.username}
                          image={account.image}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="font-medium">@{account.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {account.karma.toLocaleString(locale)}{" "}
                            {tLocale(locale, "profile.karma").toLowerCase()}
                          </p>
                          {"tags" in account && account.tags ? (
                            <AccountTags tags={account.tags} size="sm" />
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SearchSection>

              <SearchSection
                title={tLocale(locale, "search.posts")}
                empty={tLocale(locale, "pages.noPostsMatched")}
                count={results.posts.length}
              >
                <ul className="space-y-2">
                  {results.posts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/post/${post.id}`}
                        className="block rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <p className="font-heading text-sm font-semibold leading-snug text-balance">
                          {post.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {/^u_/i.test(post.subredditName)
                            ? `@${post.subredditName.slice(2)}`
                            : post.subredditName}{" "}
                          · @{post.authorUsername} ·{" "}
                          {tLocale(locale, "search.points", {
                            count: post.score,
                          })}{" "}
                          · {post.commentCount}{" "}
                          {tLocale(locale, "feed.comments")}
                        </p>
                        {post.body ? (
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                            {post.body}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </SearchSection>
              <SearchSection
                title={tLocale(locale, "search.questions")}
                empty={tLocale(locale, "pages.noQuestionsMatched")}
                count={results.questions.length}
              >
                <ul className="space-y-2">
                  {results.questions.map((question) => (
                    <li key={question.id}>
                      <Link
                        href={`/questions/${question.id}`}
                        className="block rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <p className="font-heading text-sm font-semibold leading-snug text-balance">
                          {question.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {question.subredditName} · @{question.authorUsername} ·{" "}
                          {tLocale(locale, "questions.answerCount", {
                            count: question.answerCount,
                          })}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {question.body}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SearchSection>
              <SearchSection
                title={tLocale(locale, "search.listings")}
                empty={tLocale(locale, "pages.noListingsMatched")}
                count={results.listings.length}
              >
                <ul className="space-y-2">
                  {results.listings.map((listing) => (
                    <li key={listing.id}>
                      <Link
                        href={`/marketplace/${listing.id}`}
                        className="block rounded-2xl border border-border/60 bg-card/70 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-[var(--brand)]">
                            {listing.category}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{listing.location}</span>
                          <span aria-hidden>·</span>
                          <span>
                            {listing.status === "active"
                              ? tLocale(locale, "marketplace.active")
                              : listing.status === "sold"
                                ? tLocale(locale, "marketplace.sold")
                                : tLocale(locale, "marketplace.closed")}
                          </span>
                        </div>
                        <p className="mt-1 font-heading text-sm font-semibold leading-snug text-balance">
                          {listing.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          @{listing.authorUsername}
                          {listingPriceSuffix(listing.price)}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {listing.body}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SearchSection>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

function SearchSection({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}
