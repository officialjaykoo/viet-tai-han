import { expect, type Page } from "@playwright/test";

import { LANG_COOKIE } from "../../../src/lib/i18n/config";
import { MIN_DWELL_MS } from "../../../src/lib/security/bot-signals";

export const SEED_USER = {
  username: "alice",
  password: "password123",
} as const;

/** Prefer Vietnamese and skip the locale chooser dialog. */
export async function seedLocaleCookie(page: Page) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const host = new URL(base).hostname;
  await page.context().addCookies([
    {
      name: LANG_COOKIE,
      value: "vi",
      domain: host,
      path: "/",
    },
  ]);
}

/** Hide Playwright automation flags from client bot attestation. */
export async function disguiseAutomation(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      get: () => false,
    });
  });
}

/** Dismiss locale and privacy prompts if they still appear. */
export async function dismissLanguagePrompt(page: Page) {
  const preferVi = page.getByRole("button", { name: /chọn tiếng việt/i });
  if (await preferVi.isVisible().catch(() => false)) {
    await preferVi.click();
    await expect(preferVi).toBeHidden({ timeout: 5_000 });
  }

  const essentialConsent = page.getByRole("button", {
    name: /chỉ thiết yếu/i,
  });
  if (await essentialConsent.isVisible().catch(() => false)) {
    await essentialConsent.click();
    await expect(essentialConsent).toBeHidden({ timeout: 5_000 });
  }
}

/**
 * Satisfy client/server bot attestation without E2E_BOT_BYPASS
 * (needed when reusing a local `next dev` that was started without it).
 */
export async function warmBotGuard(page: Page) {
  await page.waitForTimeout(MIN_DWELL_MS + 150);
  await page.mouse.move(24, 24);
  await page.mouse.move(120, 80);
  await page.mouse.move(200, 160);
}

/** Wait until a client-side form has bound its event handlers. */
export async function waitForHydration(page: Page) {
  await expect(page.locator('[data-hydrated="true"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Sign in as the local seed admin account. */
export async function loginAsAlice(page: Page, next = "/") {
  await seedLocaleCookie(page);
  await disguiseAutomation(page);
  await page.goto(`/login?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
  });
  await dismissLanguagePrompt(page);
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: /đăng nhập/i })).toBeVisible();
  await warmBotGuard(page);

  const username = page.getByLabel(/tên người dùng/i);
  const password = page.getByLabel(/^mật khẩu$/i);
  await username.fill(SEED_USER.username);
  await password.fill(SEED_USER.password);
  await page.keyboard.press("Tab");

  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await expect(page.getByRole("button", { name: /đang đăng nhập/i })).toBeVisible({
    timeout: 5_000,
  }).catch(() => undefined);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 45_000,
  });
  await dismissLanguagePrompt(page);
}

export async function expectSignedIn(page: Page) {
  await expect(
    page.getByRole("button", { name: /menu tài khoản/i })
  ).toBeVisible({ timeout: 15_000 });
}
