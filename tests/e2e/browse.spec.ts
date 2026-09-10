import { expect, test } from "@playwright/test";

import { dismissLanguagePrompt, seedLocaleCookie } from "./helpers/auth";

test.describe("public browsing", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocaleCookie(page);
  });

  test("guest feed uses the default home view", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(
      page.getByRole("heading", { name: "Việt tại Hàn", level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId("feed-composer")).toBeVisible();
    await expect(
      page.getByRole("tablist", { name: /loại bảng tin/i })
    ).toHaveCount(0);
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
      "/?feed=popular",
      "/",
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
    expect(mobileHrefs).toEqual(["/", "/questions", "/marketplace"]);
  });
  test("guest submit routes redirect before rendering a form", async ({ page }) => {
    await page.goto("/submit?type=image", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login\?next=%2Fsubmit%3Ftype%3Dimage/);

    await page.goto("/r/u_alice/submit", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login\?next=%2Fr%2Fu_alice%2Fsubmit/);
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
  test("Q&A state and identity links remain usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/questions/question_housing_01", {
      waitUntil: "domcontentloaded",
    });
    await dismissLanguagePrompt(page);
    await expect(page.locator('main a[href="/r/askvth"]')).toBeVisible();
    await expect(page.locator('main a[href="/u/mira"]').first()).toBeVisible();
    await expect(page.getByText(/đã giải đáp/i).first()).toBeVisible();
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
  });
  test("business detail connects owner profile and contact", async ({ page }) => {
    await page.goto("/businesses/saigon-kitchen-seoul", {
      waitUntil: "domcontentloaded",
    });
    await dismissLanguagePrompt(page);
    await expect(
      page.getByRole("heading", { name: /saigon kitchen seoul/i })
    ).toBeVisible();
    await expect(page.locator('a[href="/u/mira"]')).toBeVisible();
    await expect(page.locator('a[href="/messages?to=mira"]')).toBeVisible();
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
  test("guest messages preserve contact intent through login", async ({
    page,
  }) => {
    await page.goto("/messages?to=bob", { waitUntil: "domcontentloaded" });
    const loginUrl = new URL(page.url());
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("next")).toBe("/messages?to=bob");
    await expect(
      page.getByRole("heading", { name: /tiếp tục với/i })
    ).toBeVisible();
  });
});
