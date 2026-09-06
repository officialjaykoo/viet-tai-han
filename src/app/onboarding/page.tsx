import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getOnboardingState } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/onboarding");

  const state = await getOnboardingState(session.user.id);
  if (!state) redirect("/login?next=/onboarding");
  if (state.onboardingComplete) redirect("/");

  return <OnboardingForm state={state} />;
}
