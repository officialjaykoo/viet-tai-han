"use client";

import { KeyRoundIcon } from "lucide-react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

export function IdentityAuthButtons({
  pending,
  onFacebook,
  onZalo,
  onPasskey,
}: {
  pending: boolean;
  onFacebook: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onZalo: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPasskey?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("auth.orContinueWith")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onFacebook}
        >
          Facebook
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onZalo}
        >
          Zalo
        </Button>
      </div>
      {onPasskey ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onPasskey}
          className="w-full"
        >
          <KeyRoundIcon className="size-4" />
          {t("auth.signInWithPasskey")}
        </Button>
      ) : null}
    </div>
  );
}
