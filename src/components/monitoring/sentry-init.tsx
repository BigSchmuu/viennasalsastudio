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
        beforeSend(event) {
          return uebersetzerSchuld(event) ? null : event;
        },
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

/**
 * Hat ein Übersetzer den DOM unter React verändert?
 *
 * Google Translate hängt `translated-ltr` an `<html>` und wickelt jeden
 * Textknoten in `<font>`-Hüllen. Räumt React beim Seitenwechsel seine Knoten
 * ab, sind die inzwischen fremd eingepackt — `removeChild: The node to be
 * removed is not a child of this node`. Aus Sentry, 2026-10-23: ein Kunde, der
 * die englische Seite zusätzlich übersetzen ließ.
 *
 * Von uns ist daran nichts zu beheben. Zu verbieten wäre die Übersetzung auch
 * keine Lösung — der Kunde übersetzt offensichtlich in eine dritte Sprache, die
 * wir nicht anbieten. Also wird gemeldet, was wir ändern können, und das
 * Übrige nicht.
 *
 * Bewusst eng: nur **diese** DOM-Fehler, und nur **während** ein Übersetzer
 * tatsächlich am Werk ist. Ein `removeChild`-Fehler ohne Übersetzer wäre
 * unserer und soll ankommen.
 */
function uebersetzerSchuld(ereignis: { exception?: { values?: { value?: string }[] } }): boolean {
  const wurzel = document.documentElement.classList;
  if (!wurzel.contains("translated-ltr") && !wurzel.contains("translated-rtl")) return false;
  return (ereignis.exception?.values ?? []).some((wert) =>
    /removeChild|insertBefore|not a child of this node/.test(wert.value ?? "")
  );
}
