import type { Metadata } from "next";

/**
 * Was in den Index darf und was nicht (PROJ-57).
 *
 * Die Richtung ist entscheidend: Für die ganze App gilt „nicht aufnehmen",
 * und nur Eventseiten und Serienseiten widersprechen ausdrücklich. Andersherum
 * — jede Seite einzeln ausschließen — wäre eine Liste, die beim nächsten neuen
 * Bereich jemand zu ergänzen vergisst, und dann steht „Mein Bereich" bei
 * Google.
 *
 * Hier stehen nur die Regeln. Die Adressberechnung liegt nebenan in
 * `adressen.ts`: Sie zieht die Navigation von next-intl herein, und daran
 * scheitert jeder Test, der bloß wissen will, ob ein abgesagtes Event in den
 * Index gehört.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Die Voreinstellung der App: gefunden werden darf nichts, Links folgen schon. */
export const NICHT_INDEXIEREN: Metadata["robots"] = { index: false, follow: true };

/** Der ausdrückliche Widerspruch — nur für Eventseiten und Serienseiten. */
export const INDEXIEREN: Metadata["robots"] = { index: true, follow: true };

/**
 * Darf diese Eventseite in den Index?
 *
 * Drei Gründe dagegen, alle aus der Spezifikation: Ein Serientermin ist eine
 * von vielen fast gleichen Seiten derselben Party — in den Index gehört die
 * Serienseite. Ein abgesagtes Event lädt niemanden mehr ein. Und wer nach
 * einem Workshop sucht und zuerst einen Termin von vor einem Jahr findet, hält
 * das Studio für eingeschlafen.
 *
 * Erreichbar bleiben alle drei: Ein geteilter Link soll nicht ins Leere laufen.
 */
export function eventDarfInDenIndex(
  event: { status: string; startsAt: string; endsAt: string | null; seriesId: string | null },
  jetzt: Date
): boolean {
  if (event.seriesId) return false;
  if (event.status !== "geplant") return false;
  return eventNochNichtVorbei(event.startsAt, event.endsAt, jetzt);
}

/**
 * Bis wann ein Event als kommend gilt — dieselbe Grenze wie beim Ticketverkauf
 * (PROJ-53): bis zum Ende, und ohne Ende bis Mitternacht des Folgetags.
 */
export function eventNochNichtVorbei(startsAt: string, endsAt: string | null, jetzt: Date): boolean {
  const ende = endsAt ? Date.parse(endsAt) : Date.parse(startsAt) + 24 * 60 * 60 * 1000;
  return ende > jetzt.getTime();
}
