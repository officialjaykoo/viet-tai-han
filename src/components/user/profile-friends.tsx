import Link from "next/link";
import { UsersRoundIcon } from "lucide-react";

import { UserAvatar } from "@/components/user/user-avatar";
import type { FriendListItem } from "@/lib/friends";

function personHref(username: string) {
  return `/u/${encodeURIComponent(username)}`;
}

export function ProfileFriends({
  friends,
  heading,
  empty,
}: {
  friends: FriendListItem[];
  heading: string;
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UsersRoundIcon className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
          <h2 className="truncate font-heading text-lg font-semibold">{heading}</h2>
        </div>
        {friends.length ? (
          <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
            {friends.length}
          </span>
        ) : null}
      </div>

      {friends.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {friends.map((friend) => (
            <li key={friend.id}>
              <Link
                href={personHref(friend.username)}
                prefetch={false}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/60"
              >
                <UserAvatar
                  username={friend.username}
                  image={friend.image}
                  size="md"
                  alt={`@${friend.username}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {friend.name || `@${friend.username}`}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{friend.username}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}
