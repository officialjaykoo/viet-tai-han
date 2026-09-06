import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const logoWidth = {
  sm: "5rem",
  md: "6.5rem",
  lg: "14rem",
} as const;

/** VTH brand logo using the Vietnamese-Korean community mark. */
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <Image
      src="/vth-logo.png"
      alt="Việt tại Hàn"
      width={559}
      height={343}
      priority={size === "lg"}
      style={{ width: logoWidth[size] }}
      className={cn("h-auto object-contain", className)}
    />
  );
}
