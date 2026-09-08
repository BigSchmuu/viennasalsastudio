"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __SENTRY_DSN__?: string;
  }
}

/** Einmal je Seitenaufruf, auch wenn React den Effekt doppelt ausführt. */
let gestartet = false;

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
//
// Nachgeladen statt fest importiert: Der Browser-Teil von Sentry wog 61 kB
// von 327 kB — auf jeder Seite, für jeden Besucher, obwohl er erst gebraucht
// wird, wenn etwas kaputtgeht. Jetzt kommt er, sobald der Browser sonst
// nichts zu tun hat. Der Preis: Ein Fehler in der ersten Sekunde bleibt
// ungemeldet. Ohne DSN wird gar nichts geladen — in Tests und lokal bleibt
// das Paket damit vollständig aus dem Weg.
export function SentryInit() {
  useEffect(() => {
    if (gestartet) return;
    const dsn = window.__SENTRY_DSN__;
    if (!dsn) return;
    gestartet = true;

    let verworfen = false;

    async function starte(): Promise<void> {
      const Sentry = await import("@sentry/nextjs");
      if (verworfen) return;
      Sentry.init({
        dsn,
        tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
        enabled: true,
      });
    }

    // requestIdleCallback fehlt in älteren Safari-Fassungen — dort eben
    // schlicht kurz nach dem Laden.
    const hatLeerlauf = typeof window.requestIdleCallback === "function";
    const kennung = hatLeerlauf
      ? window.requestIdleCallback(() => void starte(), { timeout: 3000 })
      : window.setTimeout(() => void starte(), 1500);

    return () => {
      verworfen = true;
      if (hatLeerlauf) window.cancelIdleCallback(kennung);
      else window.clearTimeout(kennung);
    };
  }, []);

  return null;
}
