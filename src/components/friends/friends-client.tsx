"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  CheckIcon,
  UserMinusIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { RelativeTime } from "@/components/time/relative-time";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import { apiFetch } from "@/lib/api-client";

type FriendPerson = {
  id: string;
  username: string;
  name: string;
  image: string | null;
};

type FriendItem = FriendPerson & { since: string };
type FriendRequest = {
  id: string;
  createdAt: string;
  user: FriendPerson;
};

type Action =
  | { action: "accept" | "decline" | "cancel"; requestId: string }
  | { action: "remove"; userId: string };

type FriendResponse = {
  friend?: FriendItem | null;
  error?: string;
};

function personHref(username: string) {
  return `/u/${encodeURIComponent(username)}`;
}

function PersonCard({
  person,
  meta,
  actions,
}: {
  person: FriendPerson;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
      <Link
        href={personHref(person.username)}
        prefetch={false}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        aria-label={`@${person.username}`}
      >
        <UserAvatar
          username={person.username}
          image={person.image}
          size="md"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={personHref(person.username)}
          prefetch={false}
          className="block truncate text-sm font-semibold hover:underline"
        >
          {person.name || `@${person.username}`}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          @{person.username}
          {meta ? <> · {meta}</> : null}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {actions}
        </div>
      ) : null}
    </li>
  );
}

export function FriendsClient({
  initialFriends,
  initialIncoming,
  initialOutgoing,
}: {
  initialFriends: FriendItem[];
  initialIncoming: FriendRequest[];
  initialOutgoing: FriendRequest[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [friends, setFriends] = useState(initialFriends);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(input: Action) {
    const key = input.action === "remove" ? input.userId : input.requestId;
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      try {
        const res = await apiFetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (res.status === 401) {
          router.push("/login?next=/friends");
          return;
        }
        const data = (await res.json().catch(() => null)) as FriendResponse | null;
        if (!res.ok) {
          setError(data?.error ?? t("common.error"));
          return;
        }

        if (input.action === "accept") {
          setIncoming((items) => items.filter((item) => item.id !== input.requestId));
          if (data?.friend) {
            setFriends((items) => [
              data.friend!,
              ...items.filter((item) => item.id !== data.friend!.id),
            ]);
          }
        } else if (input.action === "decline") {
          setIncoming((items) => items.filter((item) => item.id !== input.requestId));
        } else if (input.action === "cancel") {
          setOutgoing((items) => items.filter((item) => item.id !== input.requestId));
        } else if (input.action === "remove") {
          setFriends((items) => items.filter((item) => item.id !== input.userId));
        }
        router.refresh();
      } catch {
        setError(t("common.error"));
      } finally {
        setPendingKey(null);
      }
    });
  }

  const relative = (value: string) => (
    <RelativeTime value={value} />
  );

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] text-[var(--brand)]">
            <UsersRoundIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
              {t("friends.title")}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("friends.list")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("friends.description")}
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">
              {t("friends.incoming")}
            </h2>
            {incoming.length ? (
              <span className="rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
                {incoming.length}
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {incoming.map((request) => (
              <PersonCard
                key={request.id}
                person={request.user}
                meta={relative(request.createdAt)}
                actions={
                  <>
                    <Button
                      type="button"
                      size="icon-sm"
                      aria-label={t("friends.accept")}
                      title={t("friends.accept")}
                      disabled={pending || pendingKey === request.id}
                      onClick={() => run({ action: "accept", requestId: request.id })}
                    >
                      <CheckIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={t("friends.decline")}
                      title={t("friends.decline")}
                      disabled={pending || pendingKey === request.id}
                      onClick={() => run({ action: "decline", requestId: request.id })}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </>
                }
              />
            ))}
            {!incoming.length ? (
              <li className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                {t("friends.emptyIncoming")}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">
              {t("friends.outgoing")}
            </h2>
            {outgoing.length ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {outgoing.length}
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {outgoing.map((request) => (
              <PersonCard
                key={request.id}
                person={request.user}
                meta={relative(request.createdAt)}
                actions={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={t("friends.cancel")}
                    title={t("friends.cancel")}
                    disabled={pending || pendingKey === request.id}
                    onClick={() => run({ action: "cancel", requestId: request.id })}
                  >
                    <XIcon className="size-4" />
                  </Button>
                }
              />
            ))}
            {!outgoing.length ? (
              <li className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                {t("friends.emptyOutgoing")}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">
              {t("friends.list")}
            </h2>
            {friends.length ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {friends.length}
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {friends.map((friend) => (
              <PersonCard
                key={friend.id}
                person={friend}
                meta={relative(friend.since)}
                actions={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={t("friends.remove")}
                    title={t("friends.remove")}
                    disabled={pending || pendingKey === friend.id}
                    onClick={() => run({ action: "remove", userId: friend.id })}
                  >
                    <UserMinusIcon className="size-4" />
                  </Button>
                }
              />
            ))}
            {!friends.length ? (
              <li className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                <UserRoundPlusIcon className="mx-auto mb-2 size-5" aria-hidden />
                {t("friends.emptyFriends")}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
