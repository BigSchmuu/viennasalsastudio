import { STUDIO_TIMEZONE, heuteInWien } from "@/lib/constants/zeitzone";
import { dateLocale, formatDateTime } from "@/lib/formatting";

/**
 * Wann ein Event stattfindet, als eine Zeile (PROJ-53).
 *
 * Drei Formen:
 * - ohne Ende: „Sa., 03.10.2026, 21:00"
 * - ein Abend: „Sa., 03.10.2026, 21:00–02:00"
 * - mehrere Tage: „Sa., 03.10.2026, 10:00 – So., 04.10.2026, 18:00"
 *
 * Eine Party bis 2 Uhr früh endet auf dem Kalender am Folgetag, ist für Gäste
 * aber ein Abend. Als Zeitraum über zwei Tage geschrieben, sähe sie wie ein
 * Wochenend-Workshop aus. Deshalb gilt ein Ende am Folgetag vor 6 Uhr noch als
 * derselbe Abend.
 */

const LETZTE_STUNDE_DES_ABENDS = 6;

export function eventTermin(startsAt: string, endsAt: string | null, locale: string = "de"): string {
  const beginn = formatDateTime(startsAt, locale);
  if (!endsAt) return beginn;
  if (einAbend(startsAt, endsAt)) return `${beginn}–${uhrzeit(endsAt, locale)}`;
  return `${beginn} – ${formatDateTime(endsAt, locale)}`;
}

function einAbend(startsAt: string, endsAt: string): boolean {
  const startTag = heuteInWien(new Date(startsAt));
  const endTag = heuteInWien(new Date(endsAt));
  if (startTag === endTag) return true;

  const folgetag = new Date(Date.parse(`${startTag}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return endTag === folgetag && stundeInWien(endsAt) < LETZTE_STUNDE_DES_ABENDS;
}

function stundeInWien(iso: string): number {
  return Number(
    new Date(iso).toLocaleString("en-GB", { timeZone: STUDIO_TIMEZONE, hour: "2-digit", hourCycle: "h23" })
  );
}

function uhrzeit(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(dateLocale(locale), {
    timeZone: STUDIO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}
