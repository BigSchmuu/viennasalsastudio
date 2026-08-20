"use client";

import * as Sentry from "@sentry/nextjs";

// Deliberately NOT in the special instrumentation-client.ts file: Sentry's
// own Turbopack build plugin transforms process.env references in that
// (and the sentry.*.config.ts) files, and that transform doesn't reliably
// resolve NEXT_PUBLIC_ values — verified live, the DSN stayed unset in
// production no matter the variable name. A plain client component isn't
// specially recognized by that plugin, so Next's normal env inlining
// applies instead (same mechanism the existing Supabase client relies on).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

export function SentryInit() {
  return null;
}
