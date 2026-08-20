import * as Sentry from "@sentry/nextjs";

// Reads CLIENT_SENTRY_DSN (re-exposed from NEXT_PUBLIC_SENTRY_DSN in
// next.config.ts), not NEXT_PUBLIC_SENTRY_DSN directly — see the comment
// there for why.
Sentry.init({
  dsn: process.env.CLIENT_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.CLIENT_SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
