import Link from "next/link";

import {
  isProfileCommunityName,
  parseProfileCommunityName,
} from "@/lib/profile-community-name";
import { cn } from "@/lib/utils";

/** Community or personal profile label with compatibility links. */
export function SubredditLabel({
  name,
  className,
  hrefClassName,
}: {
  name: string;
  className?: string;
  hrefClassName?: string;
}) {
  const profileUser = parseProfileCommunityName(name);
  if (profileUser) {
    return (
      <Link
        href={`/u/${profileUser}`}
        prefetch={false}
        className={cn("hover:underline", hrefClassName, className)}
      >
        @{profileUser}
      </Link>
    );
  }

  return (
    <Link
      href={`/r/${name}`}
      className={cn("hover:underline", hrefClassName, className)}
    >
      {name}
    </Link>
  );
}

export function formatSubredditName(name: string): string {
  if (isProfileCommunityName(name)) {
    return `@${parseProfileCommunityName(name)}`;
  }
  return name;
}
