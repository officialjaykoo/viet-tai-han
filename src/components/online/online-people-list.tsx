"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleDotIcon } from "lucide-react";

import { ProfileActions } from "@/components/user/profile-actions";
import { apiFetch } from "@/lib/api-client";
import { UserAvatar } from "@/components/user/user-avatar";
import type { OnlineUser } from "@/lib/presence";

function personHref(username: string) {
  return `/u/${encodeURIComponent(username)}`;
}

export function OnlinePeopleList({
  initialUsers,
  heading,
  empty,
}: {
  initialUsers: OnlineUser[];
  heading: string;
  empty: string;
}) {
  const [users, setUsers] = useState(initialUsers);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await apiFetch("/api/presence");
        if (!response.ok) return;
        const data = (await response.json()) as { users?: OnlineUser[] };
        if (active && Array.isArray(data.users)) setUsers(data.users);
      } catch {
        // The server-rendered list remains available if polling is unavailable.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_8%)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDotIcon
            className="size-4 shrink-0 text-emerald-500"
            aria-hidden
          />
          <h2 className="truncate text-sm font-semibold">{heading}</h2>
        </div>
        <span
          className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          aria-hidden
        >
          {users.length}
        </span>
      </div>

      {users.length ? (
        <ul className="mt-3 divide-y divide-border/70">
          {users.map((user) => (
            <li key={user.id} className="py-2">
              <Link
                href={personHref(user.username)}
                prefetch={false}
                className="flex min-h-14 items-center gap-3 transition-colors hover:text-[var(--brand)]"
              >
                <span className="relative shrink-0">
                  <UserAvatar
                    username={user.username}
                    image={user.image}
                    size="sm"
                    alt={`@${user.username}`}
                  />
                  <span
                    className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {user.name || `@${user.username}`}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
              </Link>
              <ProfileActions
                username={user.username}
                initiallyFollowing={user.following}
                initiallyBlocked={false}
                initiallyFriendStatus={user.friendStatus}
                initiallyFriendRequestId={user.friendRequestId}
                compact
                showBlock={false}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}
