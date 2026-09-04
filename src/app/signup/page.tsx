"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { IdentityAuthButtons } from "@/components/auth/identity-auth-buttons";
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
import { authClient, signUp } from "@/lib/auth-client";
import { requiresTurnstileToken } from "@/lib/security/turnstile-client";
const subscribeToLocation = () => () => {};


export default function SignupPage() {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const bot = useBotGuard();
  const hydrated = useSyncExternalStore(
    subscribeToLocation,
    () => true,
    () => false
  );
  const callbackError = useSyncExternalStore(
    subscribeToLocation,
    () => new URLSearchParams(window.location.search).get("error"),
    () => null
  );
  const displayError =
    error ??
    (callbackError
      ? localizeError(callbackError, t("auth.couldNotSignUp"))
      : null);

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

      const { error: signUpError } = await signUp.email({
        email,
        password,
        name: name || username,
        username,
      });

      if (signUpError) {
        setError(
          localizeError(signUpError.message, t("auth.couldNotSignUp"))
        );
        return;
      }

      router.push("/");
      router.refresh();
    });
  }
  function startSocial(
    event: React.MouseEvent<HTMLButtonElement>,
    provider: "facebook" | "zalo"
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

      const result =
        provider === "facebook"
          ? await authClient.signIn.social({
              provider: "facebook",
              callbackURL: "/",
              errorCallbackURL: "/signup",
              requestSignUp: true,
            })
          : await authClient.signIn.oauth2({
              providerId: "zalo",
              callbackURL: "/",
              errorCallbackURL: "/signup",
              requestSignUp: true,
            });

      if (result.error) {
        setError(
          localizeError(result.error.message, t("auth.couldNotSignUp"))
        );
      }
    });
  }


  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center safe-px safe-pb py-10 sm:py-16">
      <Card className="w-full rounded-2xl">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            <h1 className="text-inherit">{t("auth.signUpTitle")}</h1>
          </CardTitle>
          <CardDescription>{t("auth.signUpDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate className="relative" data-hydrated={hydrated}>
          <ParserTraps setTrapRef={bot.setTrapRef} />
          <CardContent className="flex flex-col gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("auth.displayName")}</span>
              <Input
                name="name"
                autoComplete="nickname"
                enterKeyHint="next"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("auth.username")}</span>
              <Input
                required
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                pattern="[A-Za-z0-9_]{3,24}"
                title={t("auth.usernameHint")}
                enterKeyHint="next"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("auth.email")}</span>
              <Input
                required
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("auth.password")}</span>
              <Input
                required
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {displayError ? (
              <p className="text-sm text-destructive" role="alert">
                {displayError}
              </p>
            ) : null}
            <TurnstileWidget onToken={setTurnstileToken} />
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3">
            <Button
              type="submit"
              disabled={
                !hydrated || pending || requiresTurnstileToken(turnstileToken)
              }
              className="min-h-11"
            >
              {pending ? t("auth.creating") : t("auth.createAccount")}
            </Button>
            <IdentityAuthButtons
              pending={pending}
              onFacebook={(event) => startSocial(event, "facebook")}
              onZalo={(event) => startSocial(event, "zalo")}
            />
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="text-foreground underline">
                {t("auth.signIn")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
