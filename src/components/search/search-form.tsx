"use client";

import {
  ArrowRightIcon,
  FileTextIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user/user-avatar";
import { apiFetch } from "@/lib/api-client";
import type {
  SearchAccountHit,
  SearchCommunityHit,
  SearchPostHit,
  SearchResults,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type SuggestionItem =
  | { kind: "community"; href: string; data: SearchCommunityHit }
  | { kind: "account"; href: string; data: SearchAccountHit }
  | { kind: "post"; href: string; data: SearchPostHit }
  | { kind: "all"; href: string; label: string };

function buildItems(
  results: SearchResults | null,
  query: string,
  seeAllLabel: string
): SuggestionItem[] {
  if (!results || !query.trim()) return [];

  const items: SuggestionItem[] = [];

  for (const community of results.communities) {
    items.push({
      kind: "community",
      href: `/r/${community.name}`,
      data: community,
    });
  }
  for (const account of results.accounts) {
    items.push({
      kind: "account",
      href: `/u/${account.username}`,
      data: account,
    });
  }
  for (const post of results.posts) {
    items.push({
      kind: "post",
      href: `/post/${post.id}`,
      data: post,
    });
  }

  if (items.length > 0) {
    items.push({
      kind: "all",
      href: `/search?q=${encodeURIComponent(query.trim())}`,
      label: seeAllLabel,
    });
  }

  return items;
}

export function SearchForm({
  initialQuery = "",
  autoFocus = false,
  className,
  compact = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const seeAllLabel = t("search.seeAll", { query: query.trim() });
  const items = buildItems(results, query, seeAllLabel);
  const showPanel = open && query.trim().length >= 1;

  const fetchSuggestions = useEffectEvent(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/search?suggest=1&q=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok || id !== requestId.current) return;
      const data = (await res.json()) as SearchResults;
      setResults(data);
      setActiveIndex(-1);
    } catch {
      // Keep prior suggestions
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchSuggestions(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function goToSearch(q: string) {
    const trimmed = q.trim();
    setOpen(false);
    setActiveIndex(-1);
    if (!trimmed) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function activateItem(item: SuggestionItem) {
    setOpen(false);
    setActiveIndex(-1);
    router.push(item.href);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      activateItem(items[activeIndex]!);
      return;
    }
    goToSearch(query);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel || items.length === 0) {
      if (e.key === "ArrowDown" && query.trim()) {
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const hasHits =
    (results?.communities.length ?? 0) +
      (results?.accounts.length ?? 0) +
      (results?.posts.length ?? 0) >
    0;

  return (
    <form
      ref={rootRef}
      onSubmit={submit}
      role="search"
      className={cn("relative w-full", className)}
    >
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        name="q"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={
          compact ? t("search.placeholderCompact") : t("search.placeholderFull")
        }
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        className={cn(
          "pl-9",
          compact ? "h-9 rounded-full bg-muted/50 sm:h-9" : "rounded-2xl"
        )}
        aria-label={t("nav.search")}
      />

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className={cn(
            "absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-2xl border border-border/70 bg-popover shadow-lg",
            compact ? "min-w-[min(100%,22rem)]" : null
          )}
        >
          <div className="max-h-[min(70vh,24rem)] overflow-auto p-1">
            {loading && !hasHits ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {t("search.searching")}
              </p>
            ) : null}

            {!loading && !hasHits ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {t("search.noMatches")}
              </p>
            ) : null}

            {results && results.communities.length > 0 ? (
              <SuggestionGroup label={t("search.communities")}>
                {results.communities.map((community) => {
                  const index = items.findIndex(
                    (item) =>
                      item.kind === "community" &&
                      item.data.name === community.name
                  );
                  return (
                    <SuggestionRow
                      key={`c-${community.name}`}
                      id={`${listId}-option-${index}`}
                      href={`/r/${community.name}`}
                      active={activeIndex === index}
                      onHover={() => setActiveIndex(index)}
                      onSelect={() =>
                        activateItem({
                          kind: "community",
                          href: `/r/${community.name}`,
                          data: community,
                        })
                      }
                    >
                      <UsersIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          r/{community.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {community.title} ·{" "}
                          {t("search.membersCount", {
                            count: community.subscriberCount.toLocaleString(),
                          })}
                        </span>
                      </span>
                    </SuggestionRow>
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {results && results.accounts.length > 0 ? (
              <SuggestionGroup label={t("search.accounts")}>
                {results.accounts.map((account) => {
                  const index = items.findIndex(
                    (item) =>
                      item.kind === "account" &&
                      item.data.username === account.username
                  );
                  return (
                    <SuggestionRow
                      key={`a-${account.username}`}
                      id={`${listId}-option-${index}`}
                      href={`/u/${account.username}`}
                      active={activeIndex === index}
                      onHover={() => setActiveIndex(index)}
                      onSelect={() =>
                        activateItem({
                          kind: "account",
                          href: `/u/${account.username}`,
                          data: account,
                        })
                      }
                    >
                      <UserAvatar
                        username={account.username}
                        image={account.image}
                        size="xs"
                        className="mt-0.5 ring-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          u/{account.username}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t("nav.karma", {
                            count: account.karma.toLocaleString(),
                          })}
                        </span>
                      </span>
                    </SuggestionRow>
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {results && results.posts.length > 0 ? (
              <SuggestionGroup label={t("search.posts")}>
                {results.posts.map((post) => {
                  const index = items.findIndex(
                    (item) => item.kind === "post" && item.data.id === post.id
                  );
                  return (
                    <SuggestionRow
                      key={`p-${post.id}`}
                      id={`${listId}-option-${index}`}
                      href={`/post/${post.id}`}
                      active={activeIndex === index}
                      onHover={() => setActiveIndex(index)}
                      onSelect={() =>
                        activateItem({
                          kind: "post",
                          href: `/post/${post.id}`,
                          data: post,
                        })
                      }
                    >
                      <FileTextIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {post.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          r/{post.subredditName} ·{" "}
                          {t("search.points", { count: post.score })}
                        </span>
                      </span>
                    </SuggestionRow>
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {hasHits ? (
              <SuggestionRow
                id={`${listId}-option-${items.length - 1}`}
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                active={activeIndex === items.length - 1}
                onHover={() => setActiveIndex(items.length - 1)}
                onSelect={() => goToSearch(query)}
                className="mt-0.5 border-t border-border/50"
              >
                <ArrowRightIcon
                  className="size-4 shrink-0 text-[var(--brand)]"
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-[var(--brand)]">
                  {seeAllLabel}
                </span>
              </SuggestionRow>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}

function SuggestionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function SuggestionRow({
  id,
  href,
  active,
  onHover,
  onSelect,
  children,
  className,
}: {
  id: string;
  href: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      id={id}
      href={href}
      role="option"
      aria-selected={active}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors",
        active ? "bg-muted text-foreground" : "hover:bg-muted/70",
        className
      )}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      {children}
    </Link>
  );
}
