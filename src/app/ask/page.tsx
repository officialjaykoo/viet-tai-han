import Link from "next/link";

import { QuestionForm } from "@/components/questions/question-form";
import { SiteHeader } from "@/components/layout/site-header";
import { listSubreddits } from "@/lib/content";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { getSession } from "@/lib/session";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function AskQuestionPage() {
  const session = await getSession();
  await redirectIfIncompleteOnboarding(session?.user?.id);
  const { locale } = await getRequestLocale();
  const communities = (await listSubreddits(100))
    .filter((community) => !/^u_/i.test(community.name))
    .map(({ name, title }) => ({ name, title }));

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_68%)]"
        />
        <div className="relative mx-auto w-full max-w-3xl safe-px safe-pb py-6 sm:py-8">
          <Link
            href="/questions"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "questions.backToQuestions")}
          </Link>
          <section className="mt-6 mb-6">
            <p className="font-heading text-sm font-medium tracking-wide text-[var(--brand)] uppercase">
              {tLocale(locale, "questions.eyebrow")}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {tLocale(locale, "questions.askTitle")}
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {tLocale(locale, "questions.askBlurb")}
            </p>
          </section>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <QuestionForm communities={communities} />
          </div>
        </div>
      </main>
    </>
  );
}
