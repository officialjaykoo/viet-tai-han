import Link from "next/link";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listQuestions, parseQuestionFilter, type QuestionFilter } from "@/lib/qna";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: QuestionFilter =
    parseQuestionFilter(params.filter) ?? "newest";
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const questions = await listQuestions({
    limit: 50,
    filter,
    viewerUserId: session?.user?.id ?? null,
  });

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop />
        <PageShell width="standard" className="space-y-8">
          <PageHero
            eyebrow={tLocale(locale, "questions.eyebrow")}
            title={tLocale(locale, "questions.titlePage")}
            description={tLocale(locale, "questions.blurb")}
            actions={
              <Link href="/ask" className={buttonVariants({ size: "sm" })}>
                {tLocale(locale, "questions.ask")}
              </Link>
            }
          />

          <section className="space-y-3" aria-labelledby="question-list-title">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label={tLocale(locale, "questions.filterLabel")}
            >
              {(
                [
                  ["newest", "filterNewest"],
                  ["unanswered", "filterUnanswered"],
                  ["answered", "filterAnswered"],
                  ["solved", "filterSolved"],
                ] as const
              ).map(([id, labelKey]) => (
                <Link
                  key={id}
                  href={id === "newest" ? "/questions" : `/questions?filter=${id}`}
                  role="tab"
                  aria-selected={filter === id}
                  className={buttonVariants({
                    size: "sm",
                    variant: filter === id ? "default" : "outline",
                  })}
                >
                  {tLocale(locale, `questions.${labelKey}`)}
                </Link>
              ))}
            </div>
            <h2 id="question-list-title" className="font-heading text-xl font-semibold">
              {tLocale(locale, "questions.latest")}
            </h2>
            {questions.length === 0 ? (
              <EmptyState
                action={
                  <Link href="/ask" className={buttonVariants({ size: "sm" })}>
                    {tLocale(locale, "questions.askFirst")}
                  </Link>
                }
              >
                {tLocale(locale, "questions.empty")}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {questions.map((question) => (
                  <li key={question.id}>
                    <article className="rounded-2xl border border-border/60 bg-card/70 p-4 transition-colors hover:bg-muted/50 sm:p-5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                          {question.answerCount === 1
                            ? tLocale(locale, "questions.oneAnswer")
                            : tLocale(locale, "questions.answerCount", {
                                count: question.answerCount,
                              })}
                        </span>
                        <span
                          className={
                            question.acceptedAnswerId
                              ? "font-medium text-emerald-700 dark:text-emerald-400"
                              : "font-medium text-foreground"
                          }
                        >
                          {tLocale(
                            locale,
                            question.acceptedAnswerId
                              ? "questions.filterSolved"
                              : question.answerCount > 0
                                ? "questions.filterAnswered"
                                : "questions.filterUnanswered"
                          )}
                        </span>
                        <span className="truncate">
                          <Link
                            href={`/r/${encodeURIComponent(question.community.name)}`}
                            className="font-medium text-[var(--brand)] hover:underline"
                          >
                            {question.community.name}
                          </Link>{" "}
                          · {tLocale(locale, "questions.by")}{" "}
                          {question.author.username ? (
                            <Link
                              href={`/u/${encodeURIComponent(question.author.username)}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              @{question.author.username}
                            </Link>
                          ) : (
                            "unknown"
                          )}
                        </span>
                      </div>
                      <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-balance">
                        <Link
                          href={`/questions/${question.id}`}
                          className="hover:underline"
                        >
                          {question.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {question.body}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        {question.author.username ? (
                          <Link
                            href={`/u/${encodeURIComponent(question.author.username)}`}
                            aria-label={`@${question.author.username}`}
                            className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                          >
                            <UserAvatar
                              username={question.author.username}
                              image={question.author.image}
                              size="xs"
                              className="ring-0"
                            />
                          </Link>
                        ) : (
                          <UserAvatar
                            username={question.author.username}
                            image={question.author.image}
                            size="xs"
                            className="ring-0"
                          />
                        )}
                        <span>
                          {new Date(question.createdAt).toLocaleDateString(
                            locale
                          )}
                        </span>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </PageShell>
      </main>
    </>
  );
}
