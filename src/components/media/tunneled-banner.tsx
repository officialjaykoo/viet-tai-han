"use client";

import { TunneledMedia } from "@/components/media/tunneled-media";

/**
 * Profile/settings banner loaded exclusively via the /i/api Protobuf tunnel.
 */
export function TunneledBanner({
  mediaKey,
  className,
}: {
  mediaKey: string;
  className?: string;
}) {
  return (
    <TunneledMedia
      mediaKey={mediaKey}
      alt=""
      className={className ?? "absolute inset-0 size-full object-cover"}
      priority
    />
  );
}
