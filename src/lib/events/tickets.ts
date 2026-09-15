import { heuteInWien } from "@/lib/constants/zeitzone";
import type { DanceRole } from "@/lib/constants/booking";

/**
 * Ticketarten, Einheiten und Plätze (PROJ-56).
 *
 * Ein Ticket ist nicht „für das Event", sondern für eine **Ticketart** — und
 * die sagt, für welche Einheiten es gilt. Ein Event ohne Einheiten ist dabei
 * der einfachste Fall, nicht der Sonderfall: eine Ticketart, die für alles
 * gilt, und nichts zu wählen.
 *
 * Hier steht nur die Rechnung. Wer sie durchsetzt, ist die Datenbank: Am Ende
 * entscheidet sie über den letzten Platz, nicht diese Datei.
 */

/** Wofür eine Ticketart gilt. */
export const GELTUNG_ALLE = "all";
export const GELTUNG_AUSWAHL = "selected";
export const GELTUNG_KUNDENWAHL = "choice";
export const GELTUNGEN = [GELTUNG_ALLE, GELTUNG_AUSWAHL, GELTUNG_KUNDENWAHL] as const;
export type Geltung = (typeof GELTUNGEN)[number];

/** Welche Zahlungsarten ein Event erlaubt. */
export const ZAHLUNG_SEPA = "sepa";
export const ZAHLUNG_BAR = "onsite";
export const ZAHLUNG_BEIDES = "both";
export const ZAHLUNGSWAHLEN = [ZAHLUNG_SEPA, ZAHLUNG_BAR, ZAHLUNG_BEIDES] as const;
export type Zahlungswahl = (typeof ZAHLUNGSWAHLEN)[number];

/** Vorgabe, wenn niemand etwas anderes einstellt (PROJ-14). */
export const STANDARD_STORNOFRIST_TAGE = 1;

export type Einheit = {
  id: string;
  titel: string;
  startsAt: string;
  endsAt: string | null;
  kapazitaet: number | null;
  /** Wie viele Plätze schon belegt sind — Tickets, nicht Gäste von Hand. */
  belegt: number;
};

export type Ticketart = {
  id: string;
  name: string;
  preisNormal: number;
  preisStudierend: number;
  /** Höchstzahl dieser Art insgesamt; `null` heißt: unbegrenzt. */
  kontingent: number | null;
  geltung: Geltung;
  /** Nur bei `selected`: die Einheiten, für die sie gilt. */
  einheitIds: string[];
  imVerkauf: boolean;
  /** Wie viele Tickets dieser Art schon verkauft sind. */
  verkauft: number;
  /**
   * Keine echte Ticketart, sondern der Preis des Events selbst.
   *
   * So sind Serientermine gebaut und alles, was vor PROJ-56 entstanden ist.
   * Beim Kauf darf ihre Kennung nicht mitgeschickt werden — sie steht in
   * keiner Tabelle, und die Datenbank wiese den Kauf ab.
   */
  implizit?: boolean;
};

/**
 * Die Einheiten, für die eine Ticketart gilt.
 *
 * Bei „Kunde wählt eine Einheit" sind es alle, aus denen er wählen darf — ein
 * gekauftes Ticket gilt dann für genau eine davon.
 */
export function einheitenFuerArt(art: Ticketart, alle: Einheit[]): Einheit[] {
  if (art.geltung === GELTUNG_AUSWAHL) {
    return alle.filter((einheit) => art.einheitIds.includes(einheit.id));
  }
  return alle;
}

/** Freie Plätze einer Einheit; `null`, wenn sie keine Kapazität hat. */
export function freiePlaetzeEinheit(einheit: Einheit): number | null {
  return einheit.kapazitaet === null ? null : Math.max(0, einheit.kapazitaet - einheit.belegt);
}

/** Rest einer Ticketart aus ihrem Kontingent; `null` heißt unbegrenzt. */
export function restKontingent(art: Ticketart): number | null {
  return art.kontingent === null ? null : Math.max(0, art.kontingent - art.verkauft);
}

export type ArtZustand = "kaufbar" | "ausverkauft" | "nichtImVerkauf";

/**
 * Ob eine Ticketart noch zu haben ist.
 *
 * Zwei Dinge können ausverkauft sein: das Kontingent der Art und die Plätze
 * der Einheiten, für die sie gilt. Bei einer festen Geltung müssen **alle**
 * ihre Einheiten Platz haben — ein Full Pass, dessen zweite Einheit voll ist,
 * ist kein halber Full Pass. Bei „Kunde wählt" genügt **eine** freie Einheit.
 */
export function artZustand(art: Ticketart, alle: Einheit[]): ArtZustand {
  if (!art.imVerkauf) return "nichtImVerkauf";

  const rest = restKontingent(art);
  if (rest !== null && rest <= 0) return "ausverkauft";

  const einheiten = einheitenFuerArt(art, alle);
  if (einheiten.length === 0) return "kaufbar";

  const platzDa = (einheit: Einheit) => {
    const frei = freiePlaetzeEinheit(einheit);
    return frei === null || frei > 0;
  };

  const genug = art.geltung === GELTUNG_KUNDENWAHL ? einheiten.some(platzDa) : einheiten.every(platzDa);
  return genug ? "kaufbar" : "ausverkauft";
}

/** Die Einheiten, die ein Kunde bei „Kunde wählt eine Einheit" nehmen kann. */
export function waehlbareEinheiten(art: Ticketart, alle: Einheit[]): Einheit[] {
  if (art.geltung !== GELTUNG_KUNDENWAHL) return [];
  return einheitenFuerArt(art, alle).filter((einheit) => {
    const frei = freiePlaetzeEinheit(einheit);
    return frei === null || frei > 0;
  });
}

/**
 * Ob ein jetzt gekauftes Ticket noch selbst storniert werden kann.
 *
 * Wie bisher ein Vergleich Wiener Kalendertage — nur ist die Frist jetzt am
 * Event einstellbar. Eine Frist von 0 Tagen heißt: bis zum Beginn.
 */
export function stornierbarMitFrist(startsAt: string, fristTage: number, jetzt: Date): boolean {
  const tage = tageZwischen(heuteInWien(jetzt), heuteInWien(new Date(startsAt)));
  return fristTage <= 0 ? new Date(startsAt) > jetzt : tage >= fristTage;
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}

/** Die Zahlungsarten, die ein Event anbietet. */
export function erlaubteZahlungsarten(wahl: Zahlungswahl): ("sepa" | "onsite")[] {
  if (wahl === ZAHLUNG_SEPA) return ["sepa"];
  if (wahl === ZAHLUNG_BAR) return ["onsite"];
  return ["sepa", "onsite"];
}

/**
 * Was der Kaufdialog an Zahlungsarten wirklich anbieten kann.
 *
 * Ohne Mandat fällt SEPA weg — erlaubt das Event nur SEPA, bleibt nichts
 * übrig, und der Kunde braucht den Hinweis statt einer leeren Auswahl.
 */
export function zahlungsartenImDialog(wahl: Zahlungswahl, hatMandat: boolean): ("sepa" | "onsite")[] {
  return erlaubteZahlungsarten(wahl).filter((art) => art !== "sepa" || hatMandat);
}

/** Eine Ticketart zum Nulltarif braucht weder Zahlungsart noch Mandat. */
export function istKostenlos(art: Pick<Ticketart, "preisNormal" | "preisStudierend">): boolean {
  return art.preisNormal === 0 && art.preisStudierend === 0;
}

/**
 * Ob eine weitere Person dieser Rolle die Runde zu schief machen würde.
 *
 * Dieselbe Regel wie bei den Kursen (PROJ-30): Nicht feste Plätze je Rolle,
 * sondern ein größter erlaubter Abstand. Feste Kontingente führten dazu, dass
 * ein Workshop für die eine Rolle ausverkauft ist, während für die andere
 * Plätze leer bleiben.
 */
export function rollePasst(
  rolle: DanceRole | null,
  bestand: { leader: number; follower: number },
  maxAbstand: number | null
): boolean {
  if (maxAbstand === null || rolle === null || rolle === "both") return true;

  const nachher =
    rolle === "leader"
      ? { leader: bestand.leader + 1, follower: bestand.follower }
      : { leader: bestand.leader, follower: bestand.follower + 1 };

  return Math.abs(nachher.leader - nachher.follower) <= maxAbstand;
}

/** Die Einheiten eines Events nach Zeit — die Reihenfolge ist das Programm. */
export function nachZeit<T extends { startsAt: string }>(einheiten: T[]): T[] {
  return [...einheiten].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Liegt die Einheit im Zeitraum des Events? */
export function einheitImEvent(
  einheit: { startsAt: string; endsAt: string | null },
  event: { startsAt: string; endsAt: string | null }
): boolean {
  const eventBeginn = Date.parse(event.startsAt);
  // Ohne Ende gilt das Event bis Mitternacht des Folgetags — dieselbe Grenze
  // wie beim Ticketverkauf (PROJ-53).
  const eventEnde = event.endsAt ? Date.parse(event.endsAt) : eventBeginn + 24 * 60 * 60 * 1000;
  const beginn = Date.parse(einheit.startsAt);
  const ende = einheit.endsAt ? Date.parse(einheit.endsAt) : beginn;

  return beginn >= eventBeginn && ende <= eventEnde && ende >= beginn;
}

/**
 * Die Einheit, die am Einlass vorgeschlagen wird: die laufende, sonst die
 * nächste, sonst die letzte.
 *
 * Am Einlass steht jemand mit dem Telefon in der Hand, während Leute
 * hereinkommen — die richtige Einheit soll schon dastehen.
 */
export function vorgeschlageneEinheit<T extends { startsAt: string; endsAt: string | null }>(
  einheiten: T[],
  jetzt: Date
): T | null {
  const sortiert = nachZeit(einheiten);
  if (sortiert.length === 0) return null;

  const zeit = jetzt.getTime();
  const laufend = sortiert.find((einheit) => {
    const beginn = Date.parse(einheit.startsAt);
    const ende = einheit.endsAt ? Date.parse(einheit.endsAt) : beginn + 60 * 60 * 1000;
    return beginn <= zeit && zeit <= ende;
  });
  if (laufend) return laufend;

  return sortiert.find((einheit) => Date.parse(einheit.startsAt) > zeit) ?? sortiert[sortiert.length - 1];
}
