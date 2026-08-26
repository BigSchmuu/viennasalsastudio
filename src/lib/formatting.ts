/**
 * Sprachabhängige Schreibweisen für Datum und Uhrzeit (PROJ-43).
 *
 * Alle drei rechnen ausdrücklich in Wien. Ohne Angabe nähmen sie die Zeitzone
 * des Servers — bei Vercel UTC. Ein Event am 02.09. um 22:49 UTC erschien
 * dadurch als „02.09., 22:49" statt „03.09., 00:49": falscher Tag, falsche
 * Uhrzeit.
 *
 * Für Englisch bewusst `en-IE` statt `en-US`: irisches Englisch schreibt den
 * Tag vor den Monat und rechnet in Euro — für ein Wiener Studio näher an dem,
 * was ein Kunde erwartet, als das amerikanische Format.
 *
 * Ohne Angabe bleibt es bei der österreichischen Schreibweise. So bleibt die
 * durchgehend deutsche Verwaltung unberührt, und nur der Kundenbereich reicht
 * die aktive Sprache durch.
 */
import { STUDIO_TIMEZONE } from "@/lib/constants/zeitzone";

const dateLocales: Record<string, string> = { de: "de-AT", en: "en-IE" };

export function dateLocale(locale: string = "de"): string {
  return dateLocales[locale] ?? dateLocales.de;
}

/** Datum mit Wochentag, z. B. "So., 06.09." / "Sun 06/09". */
export function formatShortDate(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleDateString(dateLocale(locale), {
    timeZone: STUDIO_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Vollständiges Datum, z. B. "06.09.2026" / "06/09/2026". */
export function formatDate(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleDateString(dateLocale(locale), {
    timeZone: STUDIO_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Datum mit Uhrzeit, z. B. "So., 06.09.2026, 19:00". */
export function formatDateTime(iso: string, locale: string = "de"): string {
  return new Date(iso).toLocaleString(dateLocale(locale), {
    timeZone: STUDIO_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
