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
  test("navigation order preserves existing profile shortcuts", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);

    await expect
      .poll(() =>
        page.locator("header nav a").evaluateAll((links) =>
          links.map((link) => link.getAttribute("href"))
        )
      )
      .toEqual(["/", "/communities", "/questions", "/marketplace", "/recommended"]);

    const sideHrefs = await page.locator("aside nav a").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    );
    expect(sideHrefs.slice(1, 9)).toEqual([
      "/",
      "/?feed=home",
      "/communities",
      "/questions",
      "/marketplace",
      "/businesses",
      "/recommended",
      "/submit",
    ]);
    expect(sideHrefs[0]).toBe(sideHrefs.at(-1));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    const mobileHrefs = await page
      .locator("nav.safe-pb-nav a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(mobileHrefs.slice(0, 6)).toEqual([
      "/",
      "/communities",
      "/questions",
      "/marketplace",
      "/businesses",
      "/notifications",
    ]);
    expect(mobileHrefs[6]).toMatch(/^\/(?:login|u\/)/);
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
