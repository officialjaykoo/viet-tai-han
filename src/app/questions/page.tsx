import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { UserAvatar } from "@/components/user/user-avatar";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { listQuestions } from "@/lib/qna";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const questions = await listQuestions({
    limit: 50,
    viewerUserId: session?.user?.id ?? null,
  });

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <PageShell width="standard" className="space-y-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
                {tLocale(locale, "questions.eyebrow")}
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {tLocale(locale, "questions.titlePage")}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tLocale(locale, "questions.blurb")}
              </p>
            </div>
            <Link
              href="/ask"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              {tLocale(locale, "questions.ask")}
            </Link>
          </section>

          <section className="space-y-3" aria-labelledby="question-list-title">
            <h2 id="question-list-title" className="font-heading text-xl font-semibold">
              {tLocale(locale, "questions.latest")}
            </h2>
            {questions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                <p>{tLocale(locale, "questions.empty")}</p>
                <Link
                  href="/ask"
                  className="mt-3 inline-flex font-medium text-[var(--brand)] hover:underline"
                >
                  {tLocale(locale, "questions.askFirst")}
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {questions.map((question) => (
                  <li key={question.id}>
                    <Link
                      href={`/questions/${question.id}`}
                      className="block rounded-2xl border border-border/60 bg-card/70 p-4 transition-colors hover:bg-muted/50 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-medium text-[var(--brand)]">
                          {question.answerCount === 1
                            ? tLocale(locale, "questions.oneAnswer")
                            : tLocale(locale, "questions.answerCount", {
                                count: question.answerCount,
                              })}
                        </span>
                        {question.acceptedAnswerId ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {tLocale(locale, "questions.solved")}
                          </span>
                        ) : null}
                        <span className="truncate">
                          <span className="font-medium text-foreground">
                            {question.community.name}
                          </span>{" "}
                          · {tLocale(locale, "questions.by")} @
                          {question.author.username ?? "unknown"}
                        </span>
                      </div>
                      <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-balance">
                        {question.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {question.body}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <UserAvatar
                          username={question.author.username}
                          image={question.author.image}
                          size="xs"
                          className="ring-0"
                        />
                        <span>
                          {new Date(question.createdAt).toLocaleDateString(
                            locale
                          )}
                        </span>
                      </div>
                    </Link>
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
