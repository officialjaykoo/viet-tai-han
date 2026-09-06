'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const navigation = [
  ["/", "Overview"],
  ["/getting-started", "Getting started"],
  ["/architecture", "Architecture"],
  ["/identity", "Identity & auth"],
  ["/social-graph", "Social graph"],
  ["/messaging", "Messaging"],
  ["/api", "API"],
  ["/security", "Security"],
  ["/deployment", "Deployment"],
] as const;

const subscribe = () => () => {};
const getServerPathname = () => "";
const developerUrl = (path: string) => `https://developers.vth.kr${path}`;


function activeHref(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/developers") return "/";
  if (normalizedPath.startsWith("/developers/")) {
    return normalizedPath.slice("/developers".length) || "/";
  }

  return normalizedPath;
}

export function DeveloperNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const getClientPathname = useCallback(() => pathname, [pathname]);
  const clientPathname = useSyncExternalStore(
    subscribe,
    getClientPathname,
    getServerPathname
  );
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const currentHref = clientPathname ? activeHref(clientPathname) : null;

  useEffect(() => {
    if (mobile && currentHref) {
      activeLinkRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [currentHref, mobile]);

  return (
    <nav
      aria-label="Developer documentation"
      className={
        mobile
          ? "mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-border px-3 py-2 text-sm md:hidden"
          : "sticky top-20 space-y-1 text-sm"
      }
    >
      {!mobile && (
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Guide
        </div>
      )}
      {navigation.map(([href, label]) => {
        const isActive = currentHref === href;
        return (
          <a
            key={href}
            ref={isActive ? activeLinkRef : undefined}
            href={developerUrl(href)}
            aria-current={isActive ? "page" : undefined}
            className={[
              mobile ? "shrink-0 rounded-md px-3 py-1.5" : "block rounded-md px-3 py-2",
              "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-muted text-foreground font-semibold ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
