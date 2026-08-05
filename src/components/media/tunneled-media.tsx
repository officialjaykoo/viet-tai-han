"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export { mediaKeyFromImageField } from "@/lib/media-key";

type TunneledMediaProps = {
  mediaKey: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
};

/**
 * Loads R2 media through POST /i/api (Protobuf) and displays via blob URL.
 * Never exposes a direct /api/media or /i/media GET URL in the document.
 */
export function TunneledMedia({
  mediaKey,
  alt,
  className,
  style,
  priority = false,
}: TunneledMediaProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const path = mediaKey.startsWith("/api/media/")
          ? mediaKey
          : mediaKey.startsWith("media/")
            ? `/api/media/${mediaKey}`
            : `/api/media/${mediaKey}`;
        const res = await apiFetch(path);
        if (!res.ok) {
          if (!cancelled) setFailed(true);
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaKey]);

  if (failed) {
    return (
      <div
        className={cn("bg-muted/40", className)}
        style={style}
        role="img"
        aria-label={alt}
      />
    );
  }

  if (!src) {
    return (
      <div
        className={cn("animate-pulse bg-muted/40", className)}
        style={style}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs from tunnel
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
