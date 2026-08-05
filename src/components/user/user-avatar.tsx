import {
  type AvatarSize,
  avatarSizePx,
  resolveAvatarSrc,
} from "@/lib/avatar";
import { mediaKeyFromImageField } from "@/lib/media-key";
import { cn } from "@/lib/utils";
import { TunneledMedia } from "@/components/media/tunneled-media";

type UserAvatarProps = {
  username?: string | null;
  image?: string | null;
  size?: AvatarSize;
  className?: string;
  alt?: string;
};

export function UserAvatar({
  username,
  image,
  size = "md",
  className,
  alt,
}: UserAvatarProps) {
  const seed = username?.trim() || "anonymous";
  const label = alt ?? (username ? `u/${username}` : "User avatar");
  const px = avatarSizePx(size);
  const mediaKey = mediaKeyFromImageField(image);
  const shellClass = cn(
    "shrink-0 rounded-full bg-muted object-cover ring-1 ring-border/50",
    className
  );

  if (mediaKey) {
    return (
      <TunneledMedia
        mediaKey={mediaKey}
        alt={label}
        className={shellClass}
        style={{ width: px, height: px }}
        priority
      />
    );
  }

  const { src } = resolveAvatarSrc(image, seed);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG data URIs / arbitrary remote avatars
    <img
      src={src}
      alt={label}
      width={px}
      height={px}
      decoding="async"
      className={shellClass}
      style={{ width: px, height: px }}
    />
  );
}
