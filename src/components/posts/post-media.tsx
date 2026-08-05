import { cn } from "@/lib/utils";
import { TunneledMedia } from "@/components/media/tunneled-media";

export function PostMedia({
  mediaKey,
  alt,
  className,
  priority = false,
}: {
  mediaKey: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <TunneledMedia
      mediaKey={mediaKey}
      alt={alt}
      priority={priority}
      className={cn(
        "w-full rounded-xl border border-border/50 bg-muted/30 object-contain",
        className
      )}
    />
  );
}
