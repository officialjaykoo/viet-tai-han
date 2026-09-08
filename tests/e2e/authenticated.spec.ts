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

  test("account can post, comment, like, hide, open settings, create community", async ({
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

    // Comment + like
    await warmBotGuard(page);
    const commentBody = `E2E comment ${Date.now()}`;
    await page.getByLabel(/^bình luận$/i).fill(commentBody);
    await page.getByRole("button", { name: /^bình luận$/i }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: commentBody })
    ).toBeVisible({ timeout: 30_000 });

    const likeButton = page.getByRole("button", { name: /^thích$/i }).first();
    await likeButton.click();
    await expect(likeButton).toHaveAttribute("aria-pressed", "true", {
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
    await page.getByRole("button", { name: /tạo cộng đồng/i }).click();
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
  test("desktop header keeps navigation action order", async ({ page }) => {
    await disguiseAutomation(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAsAlice(page);
    await expectSignedIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /menu tài khoản/i })
    ).toBeVisible({ timeout: 20_000 });
    const links = await page.evaluate(() => {
      const expected = [
        "/",
        "/communities",
        "/questions",
        "/marketplace",
        "/recommended",
        "/submit",
        "/messages",
        "/notifications",
      ];
      const primary = [...document.querySelectorAll("header nav a")].map(
        (link) => {
          const rect = link.getBoundingClientRect();
          return { href: link.getAttribute("href"), left: rect.left };
        }
      );
      const visible = (href: string) => {
        const link = [...document.querySelectorAll("header a")].find((item) => {
          if (item.getAttribute("href") !== href) return false;
          const rect = item.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (!link) return null;
        const rect = link.getBoundingClientRect();
        return { href, left: rect.left };
      };
      return {
        primary,
        actions: expected.slice(5).map(visible),
      };
    });
    const expected = [
      "/",
      "/communities",
      "/questions",
      "/marketplace",
      "/recommended",
      "/submit",
      "/messages",
      "/notifications",
    ];

    expect(links.primary.map(({ href }) => href)).toEqual(expected.slice(0, 5));
    expect(links.actions).not.toContain(null);
    expect(links.actions.map((link) => link?.href)).toEqual(expected.slice(5));
    const ordered = [
      ...links.primary.map(({ left }) => left),
      ...links.actions.map((link) => link?.left ?? Number.POSITIVE_INFINITY),
    ];
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
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
  test("authenticated login and signup routes honor safe next paths", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);

    await page.goto("/login?next=%2Fmessages", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/messages$/);

    await page.goto("/signup?next=%2Fmessages", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/messages$/);
  });

  test("logout clears the session and exposes one guest CTA", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);

    const header = page.getByTestId("site-header");
    await header.getByRole("button", { name: /menu tài khoản/i }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toContainText("@alice");
    await expect(
      menu.getByRole("menuitem", { name: /đăng nhập/i })
    ).toHaveCount(0);
    await expect(
      menu.getByRole("menuitem", { name: /đăng ký/i })
    ).toHaveCount(0);
    await menu.getByRole("menuitem", { name: /đăng xuất/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });
    await expect(
      header.getByRole("link", { name: /đăng nhập/i })
    ).toHaveCount(1, { timeout: 45_000 });
    await expect(header.getByRole("link", { name: /đăng ký/i })).toHaveCount(0);
    await expect(header.getByRole("link", { name: /tin nhắn/i })).toHaveCount(0);
    await expect(header.getByRole("link", { name: /thông báo/i })).toHaveCount(0);
    await expect(header.getByAltText("@alice")).toHaveCount(0);

    const sessionResponse = await page.request.get("/api/auth/get-session");
    expect(sessionResponse.ok()).toBe(true);
    expect(await sessionResponse.json()).toBeNull();

    const protectedResponse = await page.request.get("/api/messages");
    expect(protectedResponse.status()).toBe(401);
  });

  test("logout removes private messages UI before returning home", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page, "/messages");
    await expectSignedIn(page);
    await expect(page.getByTestId("messages-page")).toBeVisible();

    await page
      .getByTestId("site-header")
      .getByRole("button", { name: /menu tài khoản/i })
      .click();
    await page.getByRole("menuitem", { name: /đăng xuất/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });
    await expect(page.getByTestId("messages-page")).toHaveCount(0);
    await expect(
      page.getByTestId("site-header").getByRole("link", { name: /tin nhắn/i })
    ).toHaveCount(0);
  });

  test("logout failure keeps authenticated UI and shows a retryable error", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);

    const header = page.getByTestId("site-header");
    await header.getByRole("button", { name: /menu tài khoản/i }).click();
    await page.route("**/i/api*", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "forced logout failure",
      });
    });

    await page.getByRole("menuitem", { name: /đăng xuất/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(header.getByRole("button", { name: /menu tài khoản/i })).toBeVisible();
    await expect(header.getByRole("alert")).toContainText(/không thể đăng xuất/i);
    await page.unroute("**/i/api*");
  });

  test("logout propagates to another tab through the Better Auth store", async ({
    page,
  }) => {
    await disguiseAutomation(page);
    await loginAsAlice(page);
    await expectSignedIn(page);

    const otherTab = await page.context().newPage();
    try {
      await otherTab.goto("/", { waitUntil: "domcontentloaded" });
      await expectSignedIn(otherTab);

      await page
        .getByTestId("site-header")
        .getByRole("button", { name: /menu tài khoản/i })
        .click();
      await page.getByRole("menuitem", { name: /đăng xuất/i }).click();
      await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });

      await otherTab.bringToFront();
      await expect(
        otherTab.getByRole("link", { name: /đăng nhập/i })
      ).toHaveCount(1, { timeout: 30_000 });
      await expect(
        otherTab.getByRole("button", { name: /menu tài khoản/i })
      ).toHaveCount(0);
    } finally {
      await otherTab.close();
    }
  });
});
