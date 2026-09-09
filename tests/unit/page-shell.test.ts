import { describe, expect, it } from "vitest";

import { PAGE_SHELL_WIDTH_CLASSES } from "@/components/layout/page-shell";

describe("PageShell widths", () => {
  it("keeps the three stable content widths", () => {
    expect(PAGE_SHELL_WIDTH_CLASSES).toEqual({
      wide: "max-w-[1240px]",
      standard: "max-w-[1024px]",
      compact: "max-w-[768px]",
    });
  });
});
