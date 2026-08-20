import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Explicit fallback for NEXT_PUBLIC_SENTRY_DSN: Sentry's own Turbopack env
  // injection into instrumentation-client.ts doesn't reliably resolve the
  // value (verified live — DSN stayed unset in the browser bundle even with
  // the Vercel env var correctly configured). Next's own `env` inlining does
  // work reliably here, so force it explicitly rather than relying on
  // Sentry's build plugin to pick it up.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No-ops (skips source map upload) until SENTRY_AUTH_TOKEN is set, see
  // docs/production/error-tracking.md.
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
