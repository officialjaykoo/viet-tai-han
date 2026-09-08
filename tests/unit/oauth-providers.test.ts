import { describe, expect, it } from "vitest";

import { getOAuthProviderCapabilities } from "@/lib/oauth-providers";

describe("OAuth provider capabilities", () => {
  it("exposes only provider readiness booleans", () => {
    expect(
      getOAuthProviderCapabilities({
        FACEBOOK_CLIENT_ID: "facebook-id",
        FACEBOOK_CLIENT_SECRET: "facebook-secret",
        KAKAO_CLIENT_ID: "kakao-id",
        ZALO_APP_ID: "zalo-id",
        ZALO_APP_SECRET: "zalo-secret",
      })
    ).toEqual({ facebook: true, kakao: true, zalo: true });
  });

  it("does not mark partially configured providers as connectable", () => {
    expect(
      getOAuthProviderCapabilities({
        FACEBOOK_CLIENT_ID: "facebook-id",
        KAKAO_CLIENT_SECRET: "kakao-secret",
        ZALO_APP_ID: "zalo-id",
      })
    ).toEqual({ facebook: false, kakao: false, zalo: false });
  });
  it("treats blank credentials as unconfigured", () => {
    expect(
      getOAuthProviderCapabilities({
        FACEBOOK_CLIENT_ID: " ",
        FACEBOOK_CLIENT_SECRET: "facebook-secret",
        KAKAO_CLIENT_ID: "\t",
        ZALO_APP_ID: "zalo-id",
        ZALO_APP_SECRET: " ",
      })
    ).toEqual({ facebook: false, kakao: false, zalo: false });
  });
});
