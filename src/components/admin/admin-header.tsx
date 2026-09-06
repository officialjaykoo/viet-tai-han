import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { getUsernameProfileHref } from "@/lib/profile-url";

export function AdminHeader({
  username,
  viewSiteLabel = "View site",
}: {
  username?: string | null;
  viewSiteLabel?: string;
}) {
  const profileHref = username ? getUsernameProfileHref(username) : null;

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-md font-heading font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
          VTH Admin
        </Link>
        <div className="flex items-center gap-1">
          <Link className="inline-flex h-8 items-center rounded-4xl px-3 text-sm font-medium hover:bg-muted" href="/">{viewSiteLabel}</Link>
          {profileHref ? (
            <Link className="inline-flex h-8 items-center rounded-4xl border border-border px-3 text-sm font-medium hover:bg-muted" href={profileHref}>@{username}</Link>
          ) : null}
        </div>
      </div>
      <AdminNav mobile />
    </header>
  );
}
