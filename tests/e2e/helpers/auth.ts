import { expect, type Page } from "@playwright/test";


import { LANG_COOKIE } from "../../../src/lib/i18n/config";
import { MIN_DWELL_MS } from "../../../src/lib/security/bot-signals";

export const SEED_USERS = {
  alice: {
    username: "alice",
    providerId: "facebook",
    accountId: "e2e_alice",
  },
  bob: {
    username: "bob",
    providerId: "facebook",
    accountId: "e2e_bob",
  },
} as const;

export const SEED_USER = SEED_USERS.alice;

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

/** Dismiss the locale prompt if it still appears. */
export async function dismissLanguagePrompt(page: Page) {
  const preferVi = page.getByRole("button", { name: /chọn tiếng việt/i });
  await preferVi
    .waitFor({ state: "visible", timeout: 1_000 })
    .catch(() => undefined);
  if (await preferVi.isVisible().catch(() => false)) {
    await preferVi.click();
    await expect(preferVi).toBeHidden({ timeout: 5_000 });
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

/** Establish a test-only session for an allowlisted seeded social account. */
export async function loginAsSeedUser(
  page: Page,
  user: keyof typeof SEED_USERS = "alice",
  next = "/"
) {
  await seedLocaleCookie(page);
  await disguiseAutomation(page);

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async (username) => {
    const response = await fetch("/api/auth/e2e-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  }, SEED_USERS[user].username);
  expect(result.ok, result.body || `HTTP ${result.status}`).toBeTruthy();

  await page.goto(next, { waitUntil: "domcontentloaded" });
  // Ensure the client session atom starts after the test session cookie exists.
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissLanguagePrompt(page);
}

export async function loginAsAlice(page: Page, next = "/") {
  await loginAsSeedUser(page, "alice", next);
}

export async function expectSignedIn(page: Page) {
  const accountMenu = page.getByRole("button", { name: /menu tài khoản/i });
  try {
    await accountMenu.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await accountMenu.waitFor({ state: "visible", timeout: 15_000 });
  }
}
