"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import {
  ParserTraps,
  passBotCheck,
  useBotGuard,
} from "@/components/security/bot-check";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";

function LoginForm() {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const bot = useBotGuard();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    bot.markTrusted(event);

    startTransition(async () => {
      const check = await passBotCheck(bot, turnstileToken);
      if (!check.ok) {
        setError(localizeError(check.error, t("common.error")));
        return;
      }

      const { error: signInError } = await signIn.username({
        username,
        password,
      });

      if (signInError) {
        setError(
          localizeError(signInError.message, t("auth.couldNotSignIn"))
        );
        return;
      }

      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    });
  }

  return (
    <Card className="w-full rounded-2xl">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          <h1 className="text-inherit">{t("auth.signInTitle")}</h1>
        </CardTitle>
        <CardDescription>{t("auth.signInDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate className="relative">
        <ParserTraps setTrapRef={bot.setTrapRef} />
        <CardContent className="flex flex-col gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{t("auth.username")}</span>
            <Input
              required
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{t("auth.password")}</span>
            <Input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <TurnstileWidget onToken={setTurnstileToken} />
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button
            type="submit"
            disabled={pending || requiresTurnstileToken(turnstileToken)}
            className="min-h-11"
          >
            {pending ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="text-foreground underline">
              {t("auth.createOne")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center safe-px safe-pb py-10 sm:py-16">
      <Suspense
        fallback={
          <div className="w-full rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
