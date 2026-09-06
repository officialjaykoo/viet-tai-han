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
function KakaoBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
    >
      <rect width="24" height="24" rx="6" fill="#FEE500" />
      <path
        fill="#191919"
        d="M12 5.6c-3.6 0-6.5 2.2-6.5 4.9 0 1.7 1.1 3.2 2.8 4.1l-.6 2.2a.45.45 0 0 0 .7.5l2.5-1.7c.4.1.7.1 1.1.1 3.6 0 6.5-2.2 6.5-4.9S15.6 5.6 12 5.6Z"
      />
      <circle cx="9.5" cy="10.5" r=".65" fill="#FEE500" />
      <circle cx="12" cy="10.5" r=".65" fill="#FEE500" />
      <circle cx="14.5" cy="10.5" r=".65" fill="#FEE500" />
    </svg>
  );
}

export function IdentityAuthButtons({
  pending,
  onFacebook,
  onZalo,
  onKakao,
}: {
  pending: boolean;
  onFacebook: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onZalo: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKakao: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onFacebook}
        className="h-11 gap-2 border-blue-500/30 bg-blue-500/[0.04] hover:border-blue-500/50 hover:bg-blue-500/[0.08]"
      >
        <span className="grid w-24 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 text-left">
          <FacebookBrandIcon />
          <span>Facebook</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onZalo}
        className="h-11 gap-2 border-sky-500/30 bg-sky-500/[0.04] hover:border-sky-500/50 hover:bg-sky-500/[0.08]"
      >
        <span className="grid w-24 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 text-left">
          <ZaloBrandIcon />
          <span>Zalo</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onKakao}
        className="h-11 gap-2 border-yellow-400/50 bg-yellow-300/[0.12] hover:border-yellow-500/70 hover:bg-yellow-300/[0.22]"
      >
        <span className="grid w-24 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 text-left">
          <KakaoBrandIcon />
          <span>Kakao</span>
        </span>
      </Button>
    </div>
  );
}
