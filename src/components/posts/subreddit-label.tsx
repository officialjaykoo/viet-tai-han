import Link from "next/link";

import { cn } from "@/lib/utils";

export function SubredditLabel({
  name,
  className,
  hrefClassName,
}: {
  name: string;
  className?: string;
  hrefClassName?: string;
}) {
  return (
    <Link
      href={`/r/${name}`}
      className={cn("hover:underline", hrefClassName, className)}
    >
      {name}
    </Link>
  );
}
