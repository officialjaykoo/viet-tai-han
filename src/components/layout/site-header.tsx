"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  CircleHelpIcon,
  CircleUserRoundIcon,
  CompassIcon,
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { SearchForm } from "@/components/search/search-form";
import { MessagesNavIcon } from "@/components/messages/messages-nav-icon";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const iconBtnClass =
  "touch-target inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function SiteHeader() {
  const { t } = useI18n();
  const { data: session, isPending } = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const visibleSession = hydrated ? session : null;
  const username =
    (visibleSession?.user as { username?: string } | undefined)?.username ??
    visibleSession?.user?.name;
  const karma = (visibleSession?.user as { karma?: number } | undefined)?.karma;
  const isAdmin =
    (visibleSession?.user as { role?: string } | undefined)?.role === "admin";
  const image = visibleSession?.user?.image ?? null;
  const authReady = hydrated && !isPending;
  const signedIn = authReady && Boolean(visibleSession?.user);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-[color-mix(in_oklch,var(--background)_88%,transparent)] backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_oklch,var(--background)_72%,transparent)] safe-pt-header">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 safe-px sm:gap-3">
        <Link
          href="/"
          className="group flex min-h-11 shrink-0 items-center gap-2"
          aria-label={t("brand.homeAria")}
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-xl bg-[var(--brand)] text-sm font-bold text-[var(--brand-foreground)] shadow-[0_8px_20px_-10px_var(--brand)] transition-transform duration-200 motion-safe:group-hover:scale-105"
          >
            v
          </span>
          <span className="hidden font-heading text-xl font-semibold tracking-tight sm:inline">
            Việt tại Hàn
          </span>
        </Link>

        <SearchForm compact className="hidden min-w-0 flex-1 sm:block" />

        <Link
          href="/search"
          className={cn(iconBtnClass, "sm:hidden")}
          aria-label={t("nav.search")}
        >
          <SearchIcon className="size-5" />
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {signedIn ? (
            <>
              <Link
                href="/submit"
                className={cn(
                  iconBtnClass,
                  "bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] text-[var(--brand)] hover:bg-[color-mix(in_oklch,var(--brand)_20%,transparent)] hover:text-[var(--brand)]"
                )}
                aria-label={t("nav.createPost")}
                title={t("nav.createPost")}
              >
                <PlusIcon className="size-5" strokeWidth={2.25} />
              </Link>
              <MessagesNavIcon />
              <NotificationsBell />
            </>
          ) : null}
          {authReady && !signedIn ? (
            <div className="mr-0.5 hidden items-center gap-1 sm:flex">
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("nav.logIn")}
              </Link>
              <Link
                href="/signup"
                className="inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {t("nav.signUp")}
              </Link>
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                iconBtnClass,
                "outline-none focus-visible:ring-3 focus-visible:ring-ring/30 data-popup-open:bg-muted data-popup-open:text-foreground"
              )}
              aria-label={signedIn ? t("nav.accountMenu") : t("nav.menu")}
            >
              {!authReady ? (
                <span className="size-8 animate-pulse rounded-full bg-muted" />
              ) : signedIn ? (
                <UserAvatar
                  username={username}
                  image={image}
                  size="md"
                  className="pointer-events-none"
                />
              ) : (
                <CircleUserRoundIcon className="size-7" strokeWidth={1.75} />
              )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-56 w-56"
            >
              {signedIn ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <span className="block truncate text-sm font-medium text-foreground">
                        @{username}
                      </span>
                      {karma != null ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t("nav.karma", { count: karma })}
                        </span>
                      ) : null}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              ) : null}

              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="min-h-11 sm:hidden"
                  render={<Link href="/search" />}
                >
                  <SearchIcon />
                  {t("nav.search")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/" />}
                >
                  <HomeIcon />
                  {t("nav.popular")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/?feed=home" />}
                >
                  <HomeIcon />
                  {t("nav.home")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/communities" />}
                >
                  <CompassIcon />
                  {t("nav.communities")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/questions" />}
                >
                  <CircleHelpIcon />
                  {t("nav.questions")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/marketplace" />}
                >
                  <ShoppingBagIcon />
                  {t("nav.marketplace")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/recommended" />}
                >
                  <SparklesIcon />
                  {t("nav.forYou")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  render={<Link href="/submit" />}
                >
                  <PlusIcon />
                  {t("nav.createPost")}
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {signedIn ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={
                        <Link href={username ? `/u/${username}` : "/"} />
                      }
                    >
                      <UserRoundIcon />
                      {t("nav.profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href="/settings" />}
                    >
                      <SettingsIcon />
                      {t("nav.settings")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href="/messages" />}
                    >
                      <MessageSquareIcon />
                      {t("nav.messages")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href="/notifications" />}
                    >
                      <BellIcon />
                      {t("nav.notifications")}
                    </DropdownMenuItem>
                    {isAdmin ? (
                      <DropdownMenuItem
                        className="min-h-11"
                        render={<Link href="/admin" />}
                      >
                        <ShieldIcon />
                        {t("nav.admin")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="min-h-11"
                      variant="destructive"
                      onClick={() => {
                        void signOut();
                      }}
                    >
                      <LogOutIcon />
                      {t("nav.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href="/login" />}
                    >
                      <LogInIcon />
                      {t("nav.logIn")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href="/signup" />}
                    >
                      <UserRoundIcon />
                      {t("nav.signUp")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
