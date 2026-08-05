import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  // @ts-expect-error TEST_MIGRATIONS injected by vitest.workers.config.mts
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
