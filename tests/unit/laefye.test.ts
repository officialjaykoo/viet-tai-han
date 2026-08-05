import { describe, expect, it } from "vitest";

import { mentionsLaefye } from "@/lib/easter-eggs/laefye";

describe("laefye easter egg", () => {
  it("detects the whole word case-insensitively", () => {
    expect(mentionsLaefye("hello laefye")).toBe(true);
    expect(mentionsLaefye("LAEFYE!")).toBe(true);
    expect(mentionsLaefye("say laefye today")).toBe(true);
    expect(mentionsLaefye(null, "laefye")).toBe(true);
  });

  it("ignores substrings and unrelated text", () => {
    expect(mentionsLaefye("laefyeish")).toBe(false);
    expect(mentionsLaefye("xlaefye")).toBe(false);
    expect(mentionsLaefye("hello world")).toBe(false);
    expect(mentionsLaefye(null, undefined, "")).toBe(false);
  });

  it("checks post title or body", () => {
    expect(mentionsLaefye("About laefye", "nothing")).toBe(true);
    expect(mentionsLaefye("Normal title", "shoutout to laefye")).toBe(true);
  });
});
