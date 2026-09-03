"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  CompassIcon,
  HomeIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: session } = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const username = hydrated
    ? (session?.user as { username?: string } | undefined)?.username ?? null
    : null;
  const profileHref = username ? `/u/${username}` : "/login";

  function active(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/login") return pathname.startsWith("/login");
    if (href === "/u/") return pathname.startsWith("/u/");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const items = [
    { href: "/", label: t("nav.home"), icon: HomeIcon },
    { href: "/communities", label: t("nav.communities"), icon: CompassIcon },
    { href: "/submit", label: t("nav.createPost"), icon: PlusIcon },
    {
      href: "/notifications",
      label: t("nav.notifications"),
      icon: BellIcon,
    },
    { href: profileHref, label: t("nav.profile"), icon: UserRoundIcon },
  ];

  return (
    <nav
      aria-label={t("nav.menu")}
      className="safe-pb-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-[color-mix(in_oklch,var(--background)_90%,transparent)] backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto flex h-16 w-full max-w-3xl items-stretch gap-1 px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={cn(
                itemClass,
                isActive && "bg-[color-mix(in_oklch,var(--brand)_10%,transparent)] text-[var(--brand)]",
                href === "/submit" &&
                  "text-[var(--brand)] hover:bg-[color-mix(in_oklch,var(--brand)_12%,transparent)]"
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
