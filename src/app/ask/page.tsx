import Link from "next/link";

import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
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
        <PageBackdrop />
        <PageShell width="compact" className="space-y-6">
        <div className="space-y-5">
          <Link
            href="/questions"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            ← {tLocale(locale, "questions.backToQuestions")}
          </Link>
          <PageHero
            eyebrow={tLocale(locale, "questions.eyebrow")}
            title={tLocale(locale, "questions.askTitle")}
            description={tLocale(locale, "questions.askBlurb")}
          />
        </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            <QuestionForm communities={communities} />
          </div>
        </PageShell>
      </main>
    </>
  );
}
