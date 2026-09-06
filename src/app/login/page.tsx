"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

import { IdentityAuthButtons } from "@/components/auth/identity-auth-buttons";
import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const bot = useBotGuard();
  const callbackError = searchParams.get("error");
  const displayError =
    error ??
    (callbackError
      ? localizeError(callbackError, t("auth.couldNotSignIn"))
      : null);

  function startIdentity(
    event: React.MouseEvent<HTMLButtonElement>,
    method: "facebook" | "zalo" | "kakao"
  ) {
    event.preventDefault();
    setError(null);
    bot.markTrusted(event);

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const callbackURL = next.startsWith("/") ? next : "/";
      const result =
        method === "facebook"
          ? await authClient.signIn.social({
              provider: "facebook",
              callbackURL,
              errorCallbackURL: "/login",
            })
          : method === "kakao"
            ? await authClient.signIn.social({
                provider: "kakao",
                callbackURL,
                errorCallbackURL: "/login",
              })
            : await authClient.signIn.oauth2({
                providerId: "zalo",
                callbackURL,
                errorCallbackURL: "/login",
              });

      if (result.error) {
        setError(
          localizeError(result.error.message, t("auth.couldNotSignIn"))
        );
      }
    });
  }


  return (
    <Card className="w-full rounded-[1.75rem] border-border/80 bg-card/95 shadow-[0_24px_80px_-28px_rgb(27_24_20_/_35%)] ring-1 ring-white/60 dark:ring-white/5">
      <CardHeader className="gap-2 px-6 pb-3 pt-7 sm:px-8">
        <CardTitle className="font-heading text-2xl tracking-tight sm:text-[1.7rem]">
          <h1 className="text-inherit">{t("auth.signInTitle")}</h1>
        </CardTitle>
        <CardDescription className="max-w-sm leading-relaxed">
          {t("auth.signInDescription")}
        </CardDescription>
      </CardHeader>
      <div className="relative">
        <ParserTraps setTrapRef={bot.setTrapRef} />
        <CardContent className="flex flex-col gap-4 px-6 sm:px-8">
          {displayError ? (
            <p
              className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {displayError}
            </p>
          ) : null}
          <TurnstileWidget onToken={setTurnstileToken} />
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4 px-6 pb-7 sm:px-8">
          <IdentityAuthButtons
            pending={pending}
            onFacebook={(event) => startIdentity(event, "facebook")}
            onZalo={(event) => startIdentity(event, "zalo")}
            onKakao={(event) => startIdentity(event, "kakao")}
          />
          <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              href="/signup"
              className="font-semibold text-[var(--flag-red)] underline decoration-[var(--flag-gold)] decoration-2 underline-offset-4 hover:text-[var(--brand-ink)]"
            >
              {t("auth.createOne")}
            </Link>
          </p>
        </CardFooter>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="w-full rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
