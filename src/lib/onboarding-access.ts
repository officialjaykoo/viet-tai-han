import { getOnboardingState } from "@/lib/onboarding";

export async function isOnboardingComplete(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return true;
  const state = await getOnboardingState(userId);
  return Boolean(state?.onboardingComplete);
}

/** Redirect signed-in users away from normal pages until profile setup ends. */
export async function redirectIfIncompleteOnboarding(
  userId: string | null | undefined
): Promise<void> {
  if (await isOnboardingComplete(userId)) return;
  const { redirect } = await import("next/navigation");
  redirect("/onboarding");
}
