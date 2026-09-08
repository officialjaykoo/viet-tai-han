"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelpIcon,
  HomeIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  UserRoundIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession } from "@/lib/auth-client";
import { resolveAuthUiState } from "@/lib/auth-ui";
import { isNavSectionActive, type ConsumerNavSection } from "@/lib/navigation";
import { getProfileHref } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const {
    data: session,
    isPending,
    error,
  } = useSession();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrationId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(hydrationId);
  }, []);

  const visibleSession = hydrated ? session : null;
  const authState = resolveAuthUiState({
    hydrated,
    session: visibleSession,
    isPending,
    error,
  });
  const signedIn = authState === "authenticated";
  const profileHref = getProfileHref(visibleSession?.user);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding"
  ) {
    return null;
  }

  function active(section: ConsumerNavSection) {
    return isNavSectionActive(pathname, section);
  }

  const items = [
    { href: "/", section: "home" as const, label: t("nav.home"), icon: HomeIcon },
    {
      href: "/questions",
      section: "questions" as const,
      label: t("nav.questions"),
      icon: CircleHelpIcon,
    },
    {
      href: "/marketplace",
      section: "marketplace" as const,
      label: t("nav.marketplace"),
      icon: ShoppingBagIcon,
    },
    ...(signedIn
      ? [
          {
            href: "/messages",
            section: "messages" as const,
            label: t("nav.messages"),
            icon: MessageSquareIcon,
          },
          {
            href: profileHref,
            section: "profile" as const,
            label: t("nav.profile"),
            icon: UserRoundIcon,
          },
        ]
      : []),
  ];

  return (
    <nav
      data-testid="mobile-nav"
      aria-label={t("nav.menu")}
      className="safe-pb-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-[color-mix(in_oklch,var(--background)_90%,transparent)] backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto flex h-16 w-full max-w-3xl items-stretch gap-1 px-2">
        {items.map(({ href, section, label, icon: Icon }) => {
          const isActive = active(section);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={cn(
                itemClass,
                isActive &&
                  "bg-[color-mix(in_oklch,var(--brand)_10%,transparent)] text-[var(--brand)]"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.8} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
