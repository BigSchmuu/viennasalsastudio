import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// PROJ-43: verdrahtet src/i18n/request.ts mit den Serverkomponenten.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// PROJ-55: Die Eventbilder liegen im Bildspeicher von Supabase. Ohne diesen
// Eintrag verweigert Next.js sie — und die Seite bliebe bilderlos, ohne dass
// im Log etwas stünde.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
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

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No-ops (skips source map upload) until SENTRY_AUTH_TOKEN is set, see
  // docs/production/error-tracking.md.
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
