import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(root, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.test.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(root, "./src"),
        "@opennextjs/cloudflare": path.resolve(
          root,
          "./tests/integration/mock-opennext.ts"
        ),
      },
    },
    test: {
      include: [
        "tests/workers/**/*.test.ts",
        "tests/integration/**/*.test.ts",
      ],
      setupFiles: ["./tests/workers/setup.ts"],
    },
  };
});
