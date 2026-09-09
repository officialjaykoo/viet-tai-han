import { expect, test, type Page } from "@playwright/test";

import {
  loginAsSeedUser,
  waitForHydration,
  warmBotGuard,
} from "./helpers/auth";

const BOB_POST = "/post/e9Ee0Ff1Gg2";
const BOB_POST_TITLE = "Error budgets for side projects";
const ALICE_POST = "/post/o7Oo8Pp9Qq0";
const ALICE_POST_TITLE = "Easter egg: shoutout to laefye";


async function currentUsername(page: Page) {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/me/settings");
    return (await result.json()) as {
      settings?: { username?: string | null };
    };
  });
  const username = response.settings?.username;
  if (!username) throw new Error("The seeded E2E user has no username");
  return username;
}

test.describe("critical browser flows", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Critical flows run on chromium-desktop only"
    );
  });

  test("popular feed renders the canonical public stream", async ({ page }) => {
    await loginAsSeedUser(page, "alice");
    await page.goto("/?feed=popular", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\?feed=popular/);
    await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
  });


  test("Alice saves Bob's post and opens the saved list", async ({ page }) => {
    await loginAsSeedUser(page, "alice", BOB_POST);
    await waitForHydration(page);

    try {
      const post = page.locator("article").filter({ hasText: BOB_POST_TITLE }).first();
      const openMenu = () =>
        post.getByRole("button", { name: /tùy chọn bài đăng/i }).click();
      await openMenu();
      const removeFromSaved = page.getByRole("menuitem", { name: /^bỏ lưu$/i });
      if (await removeFromSaved.isVisible().catch(() => false)) {
        await removeFromSaved.click();
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        await openMenu();
      }
      const savePost = page.getByRole("menuitem", { name: /^lưu bài đăng$/i });
      await expect(savePost).toBeVisible();
      await savePost.click();
      await expect(page.getByRole("status")).toContainText("Đã lưu bài đăng.", {
        timeout: 30_000,
      });
      await page.goto("/saved", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(BOB_POST_TITLE, { exact: true })).toBeVisible();
    } finally {
      await page.goto(BOB_POST, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      const post = page.locator("article").filter({ hasText: BOB_POST_TITLE }).first();
      await post.getByRole("button", { name: /tùy chọn bài đăng/i }).click();
      const removeFromSaved = page.getByRole("menuitem", { name: /^bỏ lưu$/i });
      if (await removeFromSaved.isVisible().catch(() => false)) {
        await removeFromSaved.click();
        await expect(page.getByRole("status")).toContainText("Đã bỏ lưu bài đăng.", {
          timeout: 30_000,
        });
      }
    }
  });

  test("Alice mutes Bob in discovery but can still read his post", async ({
    page,
  }) => {
    await loginAsSeedUser(page, "alice", "/u/bob");
    const muteButton = page.getByRole("button", {
      name: /^ẩn bài từ tài khoản này$/i,
    });
    const unmuteButton = page.getByRole("button", {
      name: /^hiện lại bài từ tài khoản này$/i,
    });
    await expect(muteButton.or(unmuteButton)).toBeVisible({ timeout: 30_000 });

    try {
      if (await unmuteButton.isVisible().catch(() => false)) {
        await unmuteButton.click();
        await expect(muteButton).toBeVisible();
      }
      await muteButton.click();
      await expect(unmuteButton).toBeVisible();

      await page.goto("/?feed=popular", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(BOB_POST_TITLE, { exact: true })).toHaveCount(0);

      await page.goto(BOB_POST, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("link", { name: BOB_POST_TITLE })
      ).toBeVisible();
    } finally {
      await page.goto("/u/bob", { waitUntil: "domcontentloaded" });
      const cleanupMute = page.getByRole("button", {
        name: /^ẩn bài từ tài khoản này$/i,
      });
      const cleanupUnmute = page.getByRole("button", {
        name: /^hiện lại bài từ tài khoản này$/i,
      });
      await expect(cleanupMute.or(cleanupUnmute)).toBeVisible({
        timeout: 30_000,
      });
      if (await cleanupUnmute.isVisible().catch(() => false)) {
        await cleanupUnmute.click();
      }
    }
  });

  test("Alice asks, Bob answers, and Alice accepts the answer", async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    let alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    try {
      await loginAsSeedUser(alice, "alice", "/ask");
      await waitForHydration(alice);
      await warmBotGuard(alice);
      const title = `Critical question ${Date.now()}`;
      const body = `Question details ${Date.now()}`;
      await alice.locator("#question-community").selectOption("cloudflare");
      await alice.locator("#question-title").fill(title);
      await alice.locator("#question-body").fill(body);
      await alice.getByRole("button", { name: /^đặt câu hỏi$/i }).click();
      await expect(alice).toHaveURL(/\/questions\//, { timeout: 45_000 });
      const questionPath = new URL(alice.url()).pathname;

      await loginAsSeedUser(bob, "bob", questionPath);
      await waitForHydration(bob);
      await warmBotGuard(bob);
      const answer = `Critical answer ${Date.now()}`;
      await bob.getByLabel(/^câu trả lời$/i).fill(answer);
      await bob.getByRole("button", { name: /^đăng câu trả lời$/i }).click();
      await expect(bob.getByText(answer, { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      await expect
        .poll(
          async () =>
            await alice.evaluate(
              async ({ path, expected }) => {
                const response = await fetch(
                  `${path}?refresh=${Date.now()}`,
                  { cache: "no-store" }
                );
                return (await response.text()).includes(expected);
              },
              { path: questionPath, expected: answer }
            ),
          { timeout: 30_000 }
        )
        .toBe(true);
      await alice.close();
      alice = await aliceContext.newPage();
      await alice.goto(`${questionPath}?refresh=${Date.now()}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForHydration(alice);
      const accept = alice.getByRole("button", {
        name: /^(chọn câu trả lời|câu trả lời được chọn)$/i,
      });
      await accept.click();
      await expect(accept).toHaveAttribute("aria-pressed", "true", {
        timeout: 30_000,
      });
      await alice.reload({ waitUntil: "domcontentloaded" });
      await expect(alice.getByText(/đã giải đáp/i)).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test("Alice creates a listing that Bob can browse and open", async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    try {
      await loginAsSeedUser(alice, "alice", "/marketplace/new");
      await waitForHydration(alice);
      await warmBotGuard(alice);
      const title = `Critical listing ${Date.now()}`;
      const body = `Listing details ${Date.now()}`;
      await alice.locator("#listing-category").fill("생활용품");
      await alice.locator("#listing-location").fill("Seoul");
      await alice.locator("#listing-title").fill(title);
      await alice.locator("#listing-body").fill(body);
      await alice.locator("#listing-price").fill("50000 KRW");
      await alice.getByRole("button", { name: /^đăng tin$/i }).click();
      await expect(alice).toHaveURL(/\/marketplace\//, { timeout: 45_000 });
      await expect(alice.getByRole("heading", { name: title })).toBeVisible({
        timeout: 30_000,
      });
      const listingPath = new URL(alice.url()).pathname;

      await loginAsSeedUser(bob, "bob", "/marketplace");
      await expect(
        bob.getByRole("heading", { name: /mua bán/i })
      ).toBeVisible({ timeout: 30_000 });
      await bob.goto(listingPath, { waitUntil: "domcontentloaded" });
      await expect(bob.getByRole("heading", { name: title })).toBeVisible({
        timeout: 30_000,
      });
      await expect(bob.getByText(body, { exact: true })).toBeVisible();
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test("blocking preserves public reads and denies bilateral actions", async ({
    browser,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    try {
      await loginAsSeedUser(alice, "alice");
      const alicePostPath = ALICE_POST;

      await alice.goto("/u/bob", { waitUntil: "domcontentloaded" });
      const existingUnblock = alice.getByRole("button", {
        name: /^bỏ chặn$/i,
      });
      if (await existingUnblock.isVisible().catch(() => false)) {
        await existingUnblock.click();
        await expect(
          alice.getByRole("button", { name: /^chặn$/i })
        ).toBeVisible();
      }
      await alice.waitForLoadState("networkidle");
      await alice.getByRole("button", { name: /^chặn$/i }).click();
      await expect(
        alice.getByRole("button", { name: /^bỏ chặn$/i })
      ).toBeVisible({ timeout: 15_000 });
      await alice.reload({ waitUntil: "domcontentloaded" });
      await expect(
        alice.getByRole("button", { name: /^bỏ chặn$/i })
      ).toBeVisible({ timeout: 30_000 });
      await alice.goto(BOB_POST, { waitUntil: "domcontentloaded" });
      await waitForHydration(alice);

      await expect(
        alice.getByRole("link", { name: BOB_POST_TITLE })
      ).toBeVisible({ timeout: 30_000 });
      const like = alice.getByRole("button", { name: /^thích/i }).first();
      await like.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          })
      );
      await like.click();
      await expect(like).toHaveAttribute("aria-pressed", "true", {
        timeout: 5_000,
      });
      await expect(like).toHaveAttribute("aria-pressed", "false", {
        timeout: 15_000,
      });
      const blockedComment = `blocked comment ${Date.now()}`;
      await alice.getByLabel(/^bình luận$/i).fill(blockedComment);
      await alice.getByRole("button", { name: /^bình luận$/i }).click();
      await expect(
        alice
          .locator('p[role="alert"]')
          .filter({ hasText: /could not post comment/i })
      ).toBeVisible({ timeout: 15_000 });
      await loginAsSeedUser(bob, "bob", alicePostPath);
      await waitForHydration(bob);
      await expect(
        bob.getByRole("link", { name: ALICE_POST_TITLE })
      ).toBeVisible({ timeout: 30_000 });
      const aliceUsername = await currentUsername(alice);
      await bob.goto(`/messages?to=${encodeURIComponent(aliceUsername)}`, {
        waitUntil: "domcontentloaded",
      });
      await bob.waitForLoadState("networkidle");
      await warmBotGuard(bob);
      const blockedRequest = `blocked request ${Date.now()}`;
      await bob
        .getByPlaceholder(/^gửi lời chào/i)
        .fill(blockedRequest);
      const sendButton = bob.getByRole("button", { name: /^gửi$/i });
      await expect(sendButton).toBeEnabled({ timeout: 15_000 });
      await sendButton.click();
      await expect(
        bob
          .locator('[role="alert"]')
          .filter({ hasText: /yêu cầu mạng thất bại|nhắn tin|đã xảy ra lỗi|couldn't send message/i })
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      try {
        await alice.goto("/u/bob", { waitUntil: "domcontentloaded" });
        const unblock = alice.getByRole("button", { name: /^bỏ chặn$/i });
        if (await unblock.isVisible().catch(() => false)) {
          await unblock.click();
          await expect(
            alice.getByRole("button", { name: /^chặn$/i })
          ).toBeVisible({ timeout: 15_000 });
        }
      } catch {
        // Preserve the original assertion if cleanup cannot reach the profile.
      }
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test("DM request and reply arrive through the rendered WebSocket path", async ({
    browser,
  }) => {
    test.skip(
      !process.env.PLAYWRIGHT_BASE_URL,
      "Requires a deployed worker with the ChatRoom Durable Object binding"
    );
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    const socketUrls: string[] = [];

    try {
      await loginAsSeedUser(alice, "alice", "/messages");
      const aliceUsername = await currentUsername(alice);
      await loginAsSeedUser(bob, "bob", "/messages");
      await bob.getByRole("button", { name: /^tin nhắn mới$/i }).click();
      const opener = `Realtime opener ${Date.now()}`;
      await bob.getByPlaceholder(/^tên người dùng$/i).fill(aliceUsername);
      await bob.getByPlaceholder(/^gửi lời chào/i).fill(opener);
      await bob.getByRole("button", { name: /^gửi$/i }).click();

      await alice.reload({ waitUntil: "domcontentloaded" });
      await expect(alice.getByText(opener, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      const accept = alice.getByRole("button", { name: /^chấp nhận$/i });
      if (await accept.isVisible().catch(() => false)) {
        await accept.click();
      } else {
        await alice
          .getByRole("button", { name: /@bob/i })
          .first()
          .click();
      }
      await expect(alice).toHaveURL(/\/messages\?room=/, {
        timeout: 30_000,
      });
      const roomId = new URL(alice.url()).searchParams.get("room");
      if (!roomId) throw new Error("Accepted DM did not expose a room id");

      alice.on("websocket", (socket) => socketUrls.push(socket.url()));
      await alice.reload({ waitUntil: "domcontentloaded" });
      await expect
        .poll(() => socketUrls.some((url) => url.includes("/api/messages/realtime")), {
          timeout: 30_000,
        })
        .toBe(true);

      await bob.goto(`/messages?room=${encodeURIComponent(roomId)}`, {
        waitUntil: "domcontentloaded",
      });
      const reply = `Realtime reply ${Date.now()}`;
      await bob.getByPlaceholder(/^viết tin nhắn/i).fill(reply);
      await bob.getByRole("button", { name: /^gửi$/i }).click();
      await expect(bob.getByText(reply, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(alice.getByText(reply, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });
});
