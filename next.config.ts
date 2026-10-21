import type { NextConfig } from "next";

// Strict CSP with nonces would force every page to render dynamically, so this
// keeps to the headers that cost nothing: no framing, no sniffing, no leaking URLs.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private photos: images only, nothing that could run (overrides the CSP above).
      {
        source: "/api/photos/:id",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox; frame-ancestors 'none'" }],
      },
      // Browsers must always pick up a new service worker right away.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  cacheComponents: true,
  experimental: {
    // Photo uploads (already resized in the browser, ~0.5 MB each). Vercel caps requests at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
    // Tabs feel like an app: a page visited in the last 5 minutes comes back at once from the browser's copy
    // (no loading skeleton); AutoRefresh fetches the fresh one quietly, own changes clear it via refresh().
    staleTimes: { dynamic: 300 },
  },
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
