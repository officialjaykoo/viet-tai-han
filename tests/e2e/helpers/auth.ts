import { expect, type Page } from "@playwright/test";

import { LANG_COOKIE } from "../../../src/lib/i18n/config";
import { MIN_DWELL_MS } from "../../../src/lib/security/bot-signals";

export const SEED_USER = {
  username: "alice",
  password: "password123",
} as const;

/** Prefer English and skip the locale chooser dialog. */
export async function seedLocaleCookie(page: Page) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const host = new URL(base).hostname;
  await page.context().addCookies([
    {
      name: LANG_COOKIE,
      value: "en",
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

/** Dismiss the locale chooser if it still appears. */
export async function dismissLanguagePrompt(page: Page) {
  const preferEn = page.getByRole("button", { name: /prefer english/i });
  if (await preferEn.isVisible().catch(() => false)) {
    await preferEn.click();
    await expect(preferEn).toBeHidden({ timeout: 5_000 });
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

/** Sign in as the local seed admin account. */
export async function loginAsAlice(page: Page, next = "/") {
  await seedLocaleCookie(page);
  await disguiseAutomation(page);
  await page.goto(`/login?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
  });
  await dismissLanguagePrompt(page);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await warmBotGuard(page);

  const username = page.getByLabel(/username/i);
  const password = page.getByLabel(/^password$/i);
  await username.fill(SEED_USER.username);
  await password.fill(SEED_USER.password);
  await page.keyboard.press("Tab");

  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("button", { name: /signing in/i })).toBeVisible({
    timeout: 5_000,
  }).catch(() => undefined);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 45_000,
  });
  await dismissLanguagePrompt(page);
}

export async function expectSignedIn(page: Page) {
  await expect(
    page.getByRole("button", { name: /account menu/i })
  ).toBeVisible({ timeout: 15_000 });
}
