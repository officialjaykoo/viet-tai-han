import { expect, test } from "@playwright/test";

import {
  disguiseAutomation,
  expectSignedIn,
  loginAsAlice,
  seedLocaleCookie,
  warmBotGuard,
} from "./helpers/auth";

test.describe("authenticated flows", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Auth flows run on chromium-desktop only"
    );
    await seedLocaleCookie(page);
  });

  test("account can post, comment, vote, hide, open settings, create community", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { name: "red", level: 1 })).toBeVisible();

    // Create post
    await page.goto("/submit", { waitUntil: "domcontentloaded" });
    await warmBotGuard(page);
    await expect(page.getByText("Post to")).toBeVisible({ timeout: 30_000 });

    const title = `E2E post ${Date.now()}`;
    await page
      .getByRole("button", { name: /choose a community|post to|my profile|r\//i })
      .click();
    await page.getByPlaceholder("Search communities").fill("cloudflare");
    await page
      .getByRole("option")
      .filter({ hasText: /cloudflare/i })
      .first()
      .click();
    await page.getByPlaceholder("An interesting title").fill(title);
    await page
      .getByPlaceholder("Share more context…")
      .fill("Created by Playwright e2e.");
    await page.getByRole("button", { name: /^post$/i }).click();
    await expect(page).toHaveURL(/\/post\//, { timeout: 45_000 });
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    // Comment + vote
    await warmBotGuard(page);
    const commentBody = `E2E comment ${Date.now()}`;
    await page.getByLabel(/^comment$/i).fill(commentBody);
    await page.getByRole("button", { name: /^comment$/i }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: commentBody })
    ).toBeVisible({ timeout: 30_000 });

    const upvote = page.getByRole("button", { name: /^upvote$/i }).first();
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true", {
      timeout: 15_000,
    });

    // Hide via overflow (success toast is cleared by router.refresh)
    await page.getByRole("button", { name: /post options/i }).click();
    await page.getByRole("menuitem", { name: /not interested/i }).click();
    await expect(
      page.getByRole("menuitem", { name: /not interested/i })
    ).toBeHidden({ timeout: 15_000 });

    // Settings
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole("heading", { name: /settings/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    // Create community
    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await warmBotGuard(page);
    const name = `e2e${Date.now().toString(36).slice(-6)}`;
    await page.getByPlaceholder("name (e.g. cloudflare)").fill(name);
    await page.getByPlaceholder("Display title").fill(`E2E ${name}`);
    await page
      .getByPlaceholder("About this community")
      .fill("Playwright community");
    await page.getByRole("button", { name: /create community/i }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${name}`), { timeout: 45_000 });
  });
});
