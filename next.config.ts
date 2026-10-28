import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Next.js dev badge clear of the sidebar user menu (bottom-left).
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
