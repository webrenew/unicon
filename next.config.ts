import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "ztttwtlglrbxgpydcrdi.supabase.co" },
    ],
  },
  experimental: {
    // Optimize barrel imports for lucide-react to reduce bundle size
    // This transforms `import { X } from "lucide-react"` to individual imports
    optimizePackageImports: ["lucide-react"],
  },
  // Debug logging is stripped via logger utility and dead code elimination
  // The logger checks process.env.NODE_ENV which is replaced at build time
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "webrenew",
  project: "unicon",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
