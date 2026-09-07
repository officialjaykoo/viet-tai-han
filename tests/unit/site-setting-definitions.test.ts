import { describe, expect, it } from "vitest";

import {
  getSiteSettingDefinition,
  isSensitiveSiteSettingKey,
  SITE_SETTING_DEFINITIONS,
  validateSiteSettingValue,
} from "@/lib/site-setting-definitions";

describe("site setting definitions", () => {
  it("covers every registered setting with an operational control", () => {
    expect(SITE_SETTING_DEFINITIONS.length).toBeGreaterThan(20);
    expect(
      SITE_SETTING_DEFINITIONS.every(
        (definition) => definition.label && definition.description && definition.defaultValue
      )
    ).toBe(true);
  });

  it("validates booleans and bounded numbers from the shared registry", () => {
    expect(validateSiteSettingValue("ads_enabled", "1")).toEqual({
      ok: true,
      value: "1",
    });
    expect(validateSiteSettingValue("ads_enabled", "true").ok).toBe(false);
    expect(validateSiteSettingValue("max_posts_per_hour", "12")).toEqual({
      ok: true,
      value: "12",
    });
    expect(validateSiteSettingValue("max_posts_per_hour", "1.5").ok).toBe(false);
    expect(validateSiteSettingValue("max_posts_per_hour", "-1").ok).toBe(false);
  });

  it("keeps unknown legacy keys editable without exposing sensitive keys", () => {
    expect(getSiteSettingDefinition("legacy_setting")).toBeNull();
    expect(validateSiteSettingValue("legacy_setting", "value")).toEqual({
      ok: true,
      value: "value",
    });
    expect(isSensitiveSiteSettingKey("facebook_client_secret")).toBe(true);
    expect(validateSiteSettingValue("facebook_client_secret", "secret").ok).toBe(false);
  });
});
