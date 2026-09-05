"use client";

import { Button } from "@/components/ui/button";

function FacebookBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
    >
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.43 18.63 0 12 0S0 5.43 0 12.07c0 6.02 4.39 11 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.71 4.58-4.71 1.33 0 2.72.24 2.72.24v3.02h-1.53c-1.5 0-1.97.94-1.97 1.9v2.21h3.35l-.54 3.49h-2.81V24C19.61 23.07 24 18.09 24 12.07Z"
      />
    </svg>
  );
}

function ZaloBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
    >
      <rect width="24" height="24" rx="6" fill="#0068FF" />
      <path
        fill="#fff"
        d="M6.5 6.7h11v2.1l-6.4 6.4h6.4v2.1h-11v-2.1l6.4-6.4H6.5V6.7Z"
      />
    </svg>
  );
}

export function IdentityAuthButtons({
  pending,
  onFacebook,
  onZalo,
}: {
  pending: boolean;
  onFacebook: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onZalo: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onFacebook}
        className="h-11 gap-2 border-blue-500/30 bg-blue-500/[0.04] hover:border-blue-500/50 hover:bg-blue-500/[0.08]"
      >
        <FacebookBrandIcon />
        <span>Facebook</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onZalo}
        className="h-11 gap-2 border-sky-500/30 bg-sky-500/[0.04] hover:border-sky-500/50 hover:bg-sky-500/[0.08]"
      >
        <ZaloBrandIcon />
        <span>Zalo</span>
      </Button>
    </div>
  );
}
