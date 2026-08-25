/**
 * Sprachabhängige Schreibweisen für Datum und Uhrzeit (PROJ-43).
 *
 * Für Englisch bewusst `en-IE` statt `en-US`: irisches Englisch schreibt den
 * Tag vor den Monat und rechnet in Euro — für ein Wiener Studio näher an dem,
 * was ein Kunde erwartet, als das amerikanische Format.
 *
 * Ohne Angabe bleibt es bei der österreichischen Schreibweise. So bleibt die
 * durchgehend deutsche Verwaltung unberührt, und nur der Kundenbereich reicht
 * die aktive Sprache durch.
 */
const dateLocales: Record<string, string> = { de: "de-AT", en: "en-IE" };

export function dateLocale(locale: string = "de"): string {
  return dateLocales[locale] ?? dateLocales.de;
}

/** Datum mit Wochentag, z. B. "So., 06.09." / "Sun 06/09". */
export function formatShortDate(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleDateString(dateLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Vollständiges Datum, z. B. "06.09.2026" / "06/09/2026". */
export function formatDate(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleDateString(dateLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Datum mit Uhrzeit, z. B. "So., 06.09.2026, 19:00". */
export function formatDateTime(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleString(dateLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
