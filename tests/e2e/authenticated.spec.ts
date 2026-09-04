import { expect, test } from "@playwright/test";

import {
  disguiseAutomation,
  expectSignedIn,
  loginAsAlice,
  seedLocaleCookie,
  waitForHydration,
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
    await expect(
      page.getByRole("heading", { name: "Việt tại Hàn", level: 1 })
    ).toBeVisible();

    // Create post
    await page.goto("/submit", { waitUntil: "domcontentloaded" });
    await warmBotGuard(page);
    await waitForHydration(page);
    await expect(page.getByText(/cộng đồng/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const title = `E2E post ${Date.now()}`;
    await page
      .getByRole("button", { name: /cộng đồng/i })
      .click();
    await page.getByPlaceholder(/cộng đồng/i).fill("cloudflare");
    await page
      .getByRole("option")
      .filter({ hasText: /cloudflare/i })
      .first()
      .click();
    await page.getByPlaceholder("Một tiêu đề thú vị").fill(title);
    await page
      .getByPlaceholder("Chia sẻ thêm thông tin…")
      .fill("Created by Playwright e2e.");
    await page.getByRole("button", { name: /^đăng$/i }).click();
    await expect(page).toHaveURL(/\/post\//, { timeout: 45_000 });
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    // Comment + vote
    await warmBotGuard(page);
    const commentBody = `E2E comment ${Date.now()}`;
    await page.getByLabel(/^bình luận$/i).fill(commentBody);
    await page.getByRole("button", { name: /^bình luận$/i }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: commentBody })
    ).toBeVisible({ timeout: 30_000 });

    const upvote = page.getByRole("button", { name: /^thích$/i }).first();
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true", {
      timeout: 15_000,
    });

    // Hide via overflow (success toast is cleared by router.refresh)
    await page.getByRole("button", { name: /tùy chọn bài đăng/i }).click();
    await page.getByRole("menuitem", { name: /không quan tâm/i }).click();
    await expect(
      page.getByRole("menuitem", { name: /không quan tâm/i })
    ).toBeHidden({ timeout: 15_000 });

    // Settings
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole("heading", { name: /cài đặt/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    // Create community
    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await warmBotGuard(page);
    const name = `e2e${Date.now().toString(36).slice(-6)}`;
    await page.getByPlaceholder(/tên \(ví dụ/i).fill(name);
    await page.getByPlaceholder(/tên hiển thị/i).fill(`E2E ${name}`);
    await page
      .getByPlaceholder(/giới thiệu về cộng đồng này/i)
      .fill("Playwright community");
    await page.getByRole("button", { name: /tạo cộng đồng/i }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${name}`), { timeout: 45_000 });
  });
  test("mobile chrome follows scroll direction and account menu", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const header = page.getByRole("banner");
    const mobileNav = page.locator("nav.safe-pb-nav");
    const menu = header.getByRole("button", { name: /menu tài khoản/i });
    const logo = header.getByRole("link", { name: /trang chủ việt tại hàn/i });
    const create = header.getByRole("link", { name: /^đăng bài$/i });
    const search = header.getByRole("link", { name: /^tìm kiếm$/i });
    const messages = header.getByRole("link", { name: /^tin nhắn$/i });

    await expect(menu).toBeVisible();
    await expect(logo).toBeVisible();
    await expect(create).toBeVisible();
    await expect(search).toBeVisible();
    await expect(messages).toBeVisible();
    await expect(
      menu.locator("svg.lucide-circle-user-round")
    ).toBeHidden();
    await expect(
      mobileNav.locator('a[aria-label="Đăng bài"]')
    ).toHaveCount(0);
    await expect(mobileNav.getByRole("link")).toHaveCount(7);

    const positions = await Promise.all(
      [menu, logo, create, search, messages].map(async (locator) => {
        const box = await locator.boundingBox();
        return box?.x ?? -1;
      })
    );
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(positions[2]).toBeLessThan(positions[3]);
    expect(positions[3]).toBeLessThan(positions[4]);

    await menu.click();
    const accountMenu = page.getByRole("menu");
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu).toContainText("@alice");
    await page.keyboard.press("Escape");

    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(header).toHaveClass(/-translate-y-full/);
    await expect(mobileNav).toHaveClass(/translate-y-full/);

    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(header).not.toHaveClass(/-translate-y-full/);
    await expect(mobileNav).not.toHaveClass(/translate-y-full/);
  });
});
