import Link from "next/link";

import {
  isProfileCommunityName,
  parseProfileCommunityName,
} from "@/lib/profile-community-name";
import { cn } from "@/lib/utils";

/** r/foo or u/alice for personal profile communities. */
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
        u/{profileUser}
      </Link>
    );
  }

  return (
    <Link
      href={`/r/${name}`}
      className={cn("hover:underline", hrefClassName, className)}
    >
      r/{name}
    </Link>
  );
}

export function formatSubredditName(name: string): string {
  if (isProfileCommunityName(name)) {
    return `u/${parseProfileCommunityName(name)}`;
  }
  return `r/${name}`;
}
