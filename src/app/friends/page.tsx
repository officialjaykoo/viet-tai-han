import { redirect } from "next/navigation";

import { FriendsClient } from "@/components/friends/friends-client";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import {
  listFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
} from "@/lib/friends";
import { getSession } from "@/lib/session";
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

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_10%,transparent),transparent_70%)]"
        />
        <PageShell width="wide" className="py-4 sm:py-6">
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
