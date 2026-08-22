import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // CI (and some local setups) resolve `next` from the monorepo root's
  // hoisted node_modules, not apps/web's — Turbopack's own workspace-root
  // auto-detection was landing on apps/web instead, breaking module
  // resolution entirely (confirmed via a real failed GitHub Actions run,
  // 2026-08-22). Pointing it at the actual repo root fixes resolution.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;

// Only affects local `next dev` — lets Cloudflare bindings (env vars, etc.)
// resolve correctly in dev without needing a full `wrangler dev` run. No
// effect on the actual Vercel or Cloudflare production builds.
initOpenNextCloudflareForDev();
