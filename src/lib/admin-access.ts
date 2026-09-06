import { redirect } from "next/navigation";

import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";
import { requireAdmin, type SessionUser } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function requireAdminPage(nextPath = "/admin") {
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  await redirectIfIncompleteOnboarding(session.user.id);

  try {
    return await requireAdmin(session.user as SessionUser);
  } catch {
    redirect("/");
  }
}
