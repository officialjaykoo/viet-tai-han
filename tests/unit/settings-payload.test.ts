import { describe, expect, it } from "vitest";

import {
  parseProfilePatch,
  parseSettingsPatch,
} from "@/lib/settings-payload";

describe("settings payload validation", () => {
  it("accepts typed preference patches", () => {
    expect(
      parseSettingsPatch({
        section: "preferences",
        theme: "dark",
        preferredLanguage: "ko",
        allowDms: "followers",
        notifyComments: true,
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects unexpected fields", () => {
    expect(
      parseSettingsPatch({
        section: "preferences",
        notifyChat: true,
        unexpected: false,
      })
    ).toMatchObject({ ok: false });
  });

  it("rejects invalid enum, locale, section, and empty patches", () => {
    expect(parseSettingsPatch({ section: "preferences" })).toMatchObject({
      ok: false,
    });
    expect(
      parseSettingsPatch({ section: "preferences", theme: "solarized" })
    ).toMatchObject({ ok: false, error: "Invalid theme" });
    expect(
      parseSettingsPatch({ section: "preferences", preferredLanguage: "ja" })
    ).toMatchObject({ ok: false, error: "Invalid language" });
    expect(
      parseSettingsPatch({ section: "preferences", allowDms: "friends" })
    ).toMatchObject({ ok: false, error: "Invalid DM preference" });
    expect(parseSettingsPatch({ section: "unknown", value: true })).toMatchObject({
      ok: false,
      error: "Unknown section",
    });
  });

  it("validates contact and profile patch shapes without coercion", () => {
    expect(
      parseSettingsPatch({ section: "contactEmail", contactEmail: "" })
    ).toMatchObject({ ok: true });
    expect(
      parseSettingsPatch({ section: "contactEmail", contactEmail: null })
    ).toMatchObject({ ok: false });
    expect(
      parseProfilePatch({ image: null, bio: "updated" })
    ).toMatchObject({ ok: true });
    expect(parseProfilePatch({ image: 42 })).toMatchObject({ ok: false });
    expect(parseProfilePatch({ image: null, extra: true })).toMatchObject({
      ok: false,
    });
    expect(parseProfilePatch({})).toMatchObject({ ok: false });
  });
});
