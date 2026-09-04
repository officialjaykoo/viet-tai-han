"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  CircleHelpIcon,
  CircleUserRoundIcon,
  FlameIcon,
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StoreIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

import { useI18n } from "@/components/i18n/i18n-provider";
import { SearchForm } from "@/components/search/search-form";
import { MessagesNavIcon } from "@/components/messages/messages-nav-icon";
import { useScrollVisibility } from "@/components/layout/use-scroll-visibility";
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
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const hydrationId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(hydrationId);
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
  const mobileChromeVisible = useScrollVisibility();
  const primaryNav = [
    { href: "/", label: t("nav.popular"), icon: FlameIcon },
    { href: "/questions", label: t("nav.questions"), icon: CircleHelpIcon },
    { href: "/marketplace", label: t("nav.marketplace"), icon: ShoppingBagIcon },
    { href: "/communities", label: t("nav.communities"), icon: UsersRoundIcon },
    { href: "/recommended", label: t("nav.forYou"), icon: SparklesIcon },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-t-2 border-t-[var(--flag-red)] border-b border-border/70 bg-card/95 shadow-[0_1px_3px_rgb(0_0_0_/_8%)] backdrop-blur-md supports-[backdrop-filter]:bg-card/90 safe-pt-header transition-transform duration-200 ease-out motion-reduce:transition-none",
        !mobileChromeVisible &&
          "-translate-y-full pointer-events-none sm:translate-y-0 sm:pointer-events-auto"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-2 safe-px sm:gap-3">
        <Link
          href="/"
          className="group order-2 flex min-h-11 shrink-0 items-center sm:order-0"
          aria-label={t("brand.homeAria")}
        >
          <BrandLogo size="md" />
        </Link>

        <SearchForm
          compact
          className="hidden min-w-0 flex-none sm:order-1 sm:block sm:w-56 xl:w-72"
        />

        <nav
          aria-label={t("nav.menu")}
          className="hidden min-w-0 flex-1 items-stretch justify-center gap-1 xl:order-2 xl:flex"
        >
          {primaryNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={cn(
                  "relative inline-flex min-h-11 min-w-16 flex-1 items-center justify-center rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active &&
                    "text-[var(--brand)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--brand)]"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              </Link>
            );
          })}
        </nav>

        <div className="order-1 sm:order-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                iconBtnClass,
                "outline-none focus-visible:ring-3 focus-visible:ring-ring/30 data-popup-open:bg-muted data-popup-open:text-foreground"
              )}
              aria-label={signedIn ? t("nav.accountMenu") : t("nav.menu")}
            >
              {!authReady ? (
                <>
                  <MenuIcon className="size-6 sm:hidden" strokeWidth={1.9} />
                  <span className="hidden size-8 animate-pulse rounded-full bg-muted sm:inline-flex" />
                </>
              ) : (
                <>
                  <MenuIcon className="size-6 sm:hidden" strokeWidth={1.9} />
                  <span className="hidden items-center sm:inline-flex">
                    {signedIn ? (
                      <UserAvatar
                        username={username}
                        image={image}
                        size="md"
                        className="pointer-events-none"
                      />
                    ) : (
                      <CircleUserRoundIcon
                        className="size-7"
                        strokeWidth={1.75}
                      />
                    )}
                  </span>
                </>
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
                  <FlameIcon />
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
                  <UsersRoundIcon />
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
                  render={<Link href="/businesses" />}
                >
                  <StoreIcon />
                  {t("nav.businesses")}
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
                      render={<Link href="/friends" />}
                    >
                      <UsersRoundIcon />
                      {t("nav.friends")}
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
        <div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 sm:order-2 sm:gap-1">
          <Link
            href="/search"
            className={cn(iconBtnClass, "order-2 sm:order-none sm:hidden")}
            aria-label={t("nav.search")}
          >
            <SearchIcon className="size-5" />
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/submit"
                className={cn(
                  iconBtnClass,
                  "order-1 sm:order-none bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] text-[var(--brand)] hover:bg-[color-mix(in_oklch,var(--brand)_20%,transparent)] hover:text-[var(--brand)]"
                )}
                aria-label={t("nav.createPost")}
                title={t("nav.createPost")}
              >
                <PlusIcon className="size-5" strokeWidth={2.25} />
              </Link>
              <MessagesNavIcon className="order-3 sm:order-none" />
              <NotificationsBell className="hidden order-4 sm:order-none sm:inline-flex" />
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

        </div>
      </div>
    </header>
  );
}
