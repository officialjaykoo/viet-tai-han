export const OAUTH_PROVIDER_IDS = [
  "facebook",
  "kakao",
  "zalo",
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

export type OAuthProviderEnv = {
  FACEBOOK_CLIENT_ID?: string | null;
  FACEBOOK_CLIENT_SECRET?: string | null;
  KAKAO_CLIENT_ID?: string | null;
  KAKAO_CLIENT_SECRET?: string | null;
  ZALO_APP_ID?: string | null;
  ZALO_APP_SECRET?: string | null;
};

export type OAuthProviderCapabilities = Record<OAuthProviderId, boolean>;

/**
 * Keep this predicate aligned with the provider objects built in auth.ts.
 * Only booleans cross the server/client boundary; credentials never do.
 */
function configured(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function getOAuthProviderCapabilities(
  env: OAuthProviderEnv
): OAuthProviderCapabilities {
  return {
    facebook: configured(env.FACEBOOK_CLIENT_ID) &&
      configured(env.FACEBOOK_CLIENT_SECRET),
    kakao: configured(env.KAKAO_CLIENT_ID),
    zalo: configured(env.ZALO_APP_ID) && configured(env.ZALO_APP_SECRET),
  };
}
