"use client";

import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";

declare global {
  interface Window {
    __SENTRY_DSN__?: string;
  }
}

// Reads the DSN from a value the server wrote directly into the HTML
// (see layout.tsx), not from process.env here. Sentry's own build plugin
// statically rewrites the `dsn:` field of any Sentry.init({...}) call it
// can find at build time, and that rewrite doesn't reliably resolve
// NEXT_PUBLIC_ values under Turbopack — verified live across three
// different approaches (the special instrumentation-client.ts file, two
// different env var names, and building the options object one step
// removed from the call). Reading a plain server-rendered global sidesteps
// that transform entirely: no bundler ever sees a literal `dsn:` reference
// to rewrite.
export function SentryInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const dsn = window.__SENTRY_DSN__;
    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
      enabled: !!dsn,
    });
  }, []);

  return null;
}
