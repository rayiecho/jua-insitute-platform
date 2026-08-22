import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Only affects local `next dev` — lets Cloudflare bindings (env vars, etc.)
// resolve correctly in dev without needing a full `wrangler dev` run. No
// effect on the actual Vercel or Cloudflare production builds.
initOpenNextCloudflareForDev();
