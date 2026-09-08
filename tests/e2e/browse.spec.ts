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
  test("guest navigation excludes private shortcuts", async ({
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

    const header = page.getByTestId("site-header");
    await expect(
      header.getByRole("link", { name: /đăng nhập/i })
    ).toHaveCount(1);
    await expect(
      header.getByRole("link", { name: /đăng ký/i })
    ).toHaveCount(0);
    await header.getByRole("button", { name: /^menu$/i }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /đăng nhập/i })).toHaveCount(1);
    await expect(menu.getByRole("menuitem", { name: /đăng ký/i })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    const mobileHrefs = await page
      .locator("nav.safe-pb-nav a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(mobileHrefs).toEqual([
      "/",
      "/communities",
      "/questions",
      "/marketplace",
      "/businesses",
    ]);
  });
  test("session transport errors stay neutral instead of showing guest CTA", async ({
    page,
  }) => {
    await page.route("**/i/api*", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "forced session transport failure",
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);

    const header = page.getByTestId("site-header");
    await expect(header.getByRole("button", { name: /^menu$/i })).toBeVisible();
    await expect(
      header.getByRole("link", { name: /đăng nhập/i })
    ).toHaveCount(0);
    await expect(
      header.getByRole("link", { name: /đăng ký/i })
    ).toHaveCount(0);
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
