import { expect, test } from "@playwright/test";

import { dismissLanguagePrompt, seedLocaleCookie } from "./helpers/auth";

test.describe("public browsing", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocaleCookie(page);
  });

  test("home feed sort controls are present", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(
      page.getByRole("tablist", { name: /sắp xếp bảng tin/i })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /đề xuất/i })).toBeVisible();
  });

  test("community page loads from directory", async ({ page }) => {
    await page.goto("/r/cloudflare", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(page).toHaveURL(/\/r\/cloudflare/);
    await expect(
      page.getByRole("heading", { name: /cloudflare/i })
    ).toBeVisible();
  });

  test("search page is reachable", async ({ page }) => {
    await page.goto("/search?q=cloudflare", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(
      page.locator('main form[role="search"] input[type="search"]')
    ).toBeVisible();
  });

  test("login redirect preserves next for settings", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("next=");
  });
});
