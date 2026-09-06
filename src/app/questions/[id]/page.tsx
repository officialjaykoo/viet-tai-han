import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptAnswerButton } from "@/components/questions/accept-answer-button";
import { AnswerForm } from "@/components/questions/answer-form";
import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getQuestionDetail } from "@/lib/qna";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const question = await getQuestionDetail(id, session?.user?.id ?? null);
  if (!question) notFound();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl space-y-8 safe-px safe-pb py-6 sm:py-8">
          <Link
            href="/questions"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "questions.backToQuestions")}
          </Link>

          <article className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <Link
                href={`/r/${question.community.name}`}
                className="font-medium text-[var(--brand)] hover:underline"
              >
                {question.community.name}
              </Link>
              <span aria-hidden>·</span>
              <span>
                {tLocale(locale, "questions.by")} @
                {question.author.username ?? "unknown"}
              </span>
            </div>
            <h1 className="mt-3 font-heading text-2xl font-semibold leading-tight text-balance sm:text-3xl">
              {question.title}
            </h1>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] sm:text-base">
              {question.body}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar
                username={question.author.username}
                image={question.author.image}
                size="xs"
                className="ring-0"
              />
              <span>
                {new Date(question.createdAt).toLocaleDateString(locale)}
              </span>
              {question.acceptedAnswerId ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                  {tLocale(locale, "questions.solved")}
                </span>
              ) : null}
            </div>
          </article>

          <section className="space-y-4" aria-labelledby="answers-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="answers-title"
                className="font-heading text-xl font-semibold"
              >
                {tLocale(locale, "questions.answerCount", {
                  count: question.answers.length,
                })}
              </h2>
              {question.isLocked ? (
                <span className="text-sm text-muted-foreground">
                  {tLocale(locale, "questions.locked")}
                </span>
              ) : null}
            </div>

            {question.answers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                {tLocale(locale, "questions.noAnswers")}
              </p>
            ) : (
              <ol className="space-y-4">
                {question.answers.map((answer) => (
                  <li
                    key={answer.id}
                    className={`rounded-2xl border bg-card/70 p-4 sm:p-5 ${
                      answer.isAccepted
                        ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                        : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          username={answer.author.username}
                          image={answer.author.image}
                          size="xs"
                          className="ring-0"
                        />
                        <span className="truncate">
                          @{answer.author.username ?? "unknown"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {new Date(answer.createdAt).toLocaleDateString(
                            locale
                          )}
                        </span>
                      </div>
                      {answer.isAccepted ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                          {tLocale(locale, "questions.accepted")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] sm:text-base">
                      {answer.body}
                    </div>
                    {question.author.isAuthor ? (
                      <div className="mt-4 border-t border-border/50 pt-3">
                        <AcceptAnswerButton
                          questionId={question.id}
                          answerId={answer.id}
                          initialAccepted={answer.isAccepted}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-4 sm:p-6">
            <div>
              <h2 className="font-heading text-xl font-semibold">
                {tLocale(locale, "questions.yourAnswer")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tLocale(locale, "questions.answerHint")}
              </p>
            </div>
            {question.isLocked ? (
              <p className="text-sm text-muted-foreground">
                {tLocale(locale, "questions.lockedDescription")}
              </p>
            ) : session?.user ? (
              <AnswerForm questionId={question.id} />
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/questions/${question.id}`)}`}
                className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {tLocale(locale, "questions.loginToAnswer")}
              </Link>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
