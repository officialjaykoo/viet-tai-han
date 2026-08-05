import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Allow Playwright / local tools that hit 127.0.0.1 instead of localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;

initOpenNextCloudflareForDev({
  persist: { path: ".wrangler/state/v3" },
});
