import { expect, test } from "@playwright/test";

import { dismissLanguagePrompt, seedLocaleCookie } from "./helpers/auth";

test.describe("cross-platform smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocaleCookie(page);
  });

  test("home feed renders brand and posts region", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissLanguagePrompt(page);
    await expect(
      page.getByRole("heading", { name: "Việt tại Hàn", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByTestId("feed-composer")).toBeVisible();
    await expect(page.getByTestId("feed-shortcuts")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /đăng ký|đăng nhập|trang chủ/i }).first()
    ).toBeVisible();
  });

  test("auth pages offer social continuation on narrow viewports", async ({
    page,
  }) => {
    for (const path of ["/login", "/signup"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await dismissLanguagePrompt(page);
      await expect(
        page.getByRole("heading", { name: /tiếp tục với/i })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Facebook" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Zalo" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Kakao" })).toBeVisible();
      await expect(page.getByText(/không cần email hoặc mật khẩu/i)).toBeVisible();
      await expect(
        page.locator(
          'input:not([form="_red_trap"]):not([name="cf-turnstile-response"])'
        )
      ).toHaveCount(0);
    }
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
      page.getByRole("heading", { name: /cộng đồng/i, level: 1 })
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
    await expect(page.getByRole("heading", { name: /bình luận/i })).toBeVisible();
  });
});
