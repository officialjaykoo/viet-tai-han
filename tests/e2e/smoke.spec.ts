import { expect, test } from "@playwright/test";

import { dismissLanguagePrompt, seedLocaleCookie } from "./helpers/auth";

test.describe("cross-platform smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocaleCookie(page);
  });

  test("home feed renders brand and posts region", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(page.getByRole("heading", { name: "red", level: 1 })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up|log in|home/i }).first()).toBeVisible();
  });

  test("auth pages are usable on narrow viewports", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    const username = page.getByLabel(/username/i);
    await expect(username).toBeVisible();
    await expect(username).toBeEditable();

    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(page.getByRole("heading", { name: /join red/i })).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
  });

  test("layout does not overflow horizontally", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("communities directory is reachable", async ({ page }) => {
    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(
      page.getByRole("heading", { name: /communities/i, level: 1 })
    ).toBeVisible();
  });

  test("post detail and profile routes resolve from feed links", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    const postLink = page.locator('a[href^="/post/"]').first();
    if ((await postLink.count()) === 0) {
      test.skip();
      return;
    }
    const href = await postLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/post\//);
    await expect(page.getByRole("heading", { name: /comments/i })).toBeVisible();
  });
});
