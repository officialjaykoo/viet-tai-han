import { redirect } from "next/navigation";

import { FriendsClient } from "@/components/friends/friends-client";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { PageHero } from "@/components/layout/page-hero";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import {
  listFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
} from "@/lib/friends";
import { getSession } from "@/lib/session";
import { getRequestLocale } from "@/lib/i18n/server";
import { tLocale } from "@/lib/i18n/translate";
import { redirectIfIncompleteOnboarding } from "@/lib/onboarding-access";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?next=/friends");
  }
  await redirectIfIncompleteOnboarding(session.user.id);

  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(session.user.id),
    listIncomingFriendRequests(session.user.id),
    listOutgoingFriendRequests(session.user.id),
  ]);
  const { locale } = await getRequestLocale();

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop />
        <PageShell width="wide" className="space-y-6 py-4 sm:py-6">
          <PageHero
            eyebrow={tLocale(locale, "friends.title")}
            title={tLocale(locale, "friends.list")}
            description={tLocale(locale, "friends.description")}
          />
          <FriendsClient
            initialFriends={friends}
            initialIncoming={incoming}
            initialOutgoing={outgoing}
          />
        </PageShell>
      </main>
    </>
  );
}
