"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  authErrorMessage,
  settingsErrorMessage,
} from "@/components/settings/settings-action";
import { SettingsCard } from "@/components/settings/settings-shared";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useLocalizedError } from "@/components/i18n/use-localized-error";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  OAUTH_PROVIDER_IDS,
  type OAuthProviderCapabilities,
  type OAuthProviderId,
} from "@/lib/oauth-providers";
import type { SettingsFeedback } from "@/components/settings/profile-settings";

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
};

type AccountState = {
  status: "loading" | "loaded" | "error";
  accounts: LinkedAccount[];
};

const PROVIDER_LABELS: Record<OAuthProviderId, "settings.linkFacebook" | "settings.linkKakao" | "settings.linkZalo"> = {
  facebook: "settings.linkFacebook",
  kakao: "settings.linkKakao",
  zalo: "settings.linkZalo",
};

export function ConnectedAccountsSettings({
  capabilities,
  flash,
}: {
  capabilities: OAuthProviderCapabilities;
  flash: SettingsFeedback;
}) {
  const { t } = useI18n();
  const localizeError = useLocalizedError();
  const [state, setState] = useState<AccountState>({
    status: "loading",
    accounts: [],
  });
  const [pending, startTransition] = useTransition();

  const loadAccounts = useCallback(
    async (showError = true): Promise<boolean> => {
      setState((current) => ({ ...current, status: "loading" }));
      try {
        const result = await authClient.listAccounts();
        if (result.error) {
          throw new Error(result.error.message);
        }
        const accounts = (result.data ?? [])
          .filter(
            (account) =>
              typeof account.id === "string" &&
              typeof account.providerId === "string" &&
              typeof account.accountId === "string" &&
              account.providerId !== "credential"
          )
          .map((account) => ({
            id: account.id,
            providerId: account.providerId,
            accountId: account.accountId,
          }));
        setState({ status: "loaded", accounts });
        return true;
      } catch (cause) {
        setState((current) => ({ ...current, status: "error" }));
        if (showError) {
          flash(
            null,
            settingsErrorMessage(
              cause,
              localizeError,
              t("settings.identityLoadFailed")
            )
          );
        }
        return false;
      }
    },
    [flash, localizeError, t]
  );

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadAccounts();
    }, 0);
    return () => window.clearTimeout(task);
  }, [loadAccounts]);

  function linkIdentity(provider: OAuthProviderId) {
    flash(null, null);
    startTransition(async () => {
      try {
        const callbackURL = "/settings?section=account";
        const result =
          provider === "zalo"
            ? await authClient.oauth2.link({
                providerId: "zalo",
                callbackURL,
                errorCallbackURL: callbackURL,
              })
            : await authClient.linkSocial({
                provider,
                callbackURL,
                errorCallbackURL: callbackURL,
              });
        if (result?.error) {
          throw new Error(result.error.message);
        }
      } catch (cause) {
        flash(
          null,
          authErrorMessage(cause, localizeError, t("settings.linkFailed"))
        );
      }
    });
  }

  function unlinkIdentity(account: LinkedAccount) {
    flash(null, null);
    startTransition(async () => {
      try {
        const result = await authClient.unlinkAccount({
          providerId: account.providerId,
          accountId: account.accountId,
        });
        if (result.error) throw new Error(result.error.message);
        if (!(await loadAccounts(false))) {
          throw new Error(t("settings.identityLoadFailed"));
        }
        flash(t("settings.accountUnlinked"), null);
      } catch (cause) {
        flash(
          null,
          authErrorMessage(cause, localizeError, t("settings.unlinkFailed"))
        );
      }
    });
  }

  const configuredProviders = OAUTH_PROVIDER_IDS.filter(
    (provider) => capabilities[provider]
  );
  const knownAccounts = configuredProviders.map((provider) => ({
    provider,
    account: state.accounts.find((candidate) => candidate.providerId === provider),
  }));
  const unknownAccounts = state.accounts.filter(
    (account) =>
      !configuredProviders.includes(account.providerId as OAuthProviderId)
  );

  return (
    <SettingsCard
      title={t("settings.connectedAccounts")}
      description={t("settings.connectedAccountsDesc")}
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : state.status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive" role="alert">
            {t("settings.identityLoadFailed")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void loadAccounts()}
          >
            {t("settings.retry")}
          </Button>
        </div>
      ) : configuredProviders.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t("settings.noOAuthProviders")}
          </p>
          {unknownAccounts.length ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.otherConnectedAccounts", {
                count: unknownAccounts.length,
              })}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {knownAccounts.map(({ provider, account }) => (
              <li
                key={provider}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t(PROVIDER_LABELS[provider])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account
                      ? t("settings.connected")
                      : t("settings.notConnected")}
                  </p>
                </div>
                {account ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || state.accounts.length <= 1}
                    onClick={() => unlinkIdentity(account)}
                  >
                    {t("settings.unlink")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => linkIdentity(provider)}
                  >
                    {t("settings.connect")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {unknownAccounts.length ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.otherConnectedAccounts", {
                count: unknownAccounts.length,
              })}
            </p>
          ) : null}
        </>
      )}
    </SettingsCard>
  );
}
