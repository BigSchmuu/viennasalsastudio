import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * PROJ-100: Woher kam der Klick in die Kundenakte?
 *
 * In die Akte eines Kunden führen 19 Stellen — die Anwesenheitsliste, der
 * Check-in, Rechnungen, Buchungen, offene Posten, Barzahlungen und ein Dutzend
 * mehr. Bis PROJ-100 hatte die Akte einen einzigen, fest verdrahteten Rückweg
 * auf die Kundenliste, also auf eine Seite, an der man meist nie war.
 *
 * Der Ursprung reist deshalb als `?von=` in der Adresse mit. Er steht
 * absichtlich dort und nicht in einer Sitzung: So überlebt er das Neuladen,
 * zwei Fenster stören sich nicht, und er ist prüfbar.
 *
 * Prüfbar ist hier das wichtige Wort. Ein Pfad aus der Adresse ist von außen
 * bestimmt; ein Rückweg, der überall hinzeigen darf, ist die klassische
 * Phishing-Stufe („Sitzung abgelaufen, bitte neu anmelden“). Deshalb läuft
 * `von` durch `safeRedirectPath` — dieselbe Prüfung, die der Login benutzt —
 * und der angezeigte **Name** kommt nie aus der Adresse, sondern aus der
 * Tabelle hier unten. Ein Text aus der Adresse könnte lügen, eine Tabelle im
 * Code nicht.
 */

/** Der Rückweg, den es schon immer gab. */
export const KUNDENLISTE = "/admin/kunden";

/** Der Text dieses Rückwegs, unverändert seit vor PROJ-100. */
export const STANDARD_TEXT = "zu Kunden";

export type Herkunft = {
  /** Wohin der Rückweg führt — mit Suchteil, damit Filter und Suche zurückkommen. */
  pfad: string;
  /**
   * Was hinter „Zurück “ steht — mit Artikel, denn „Zurück zu Anwesenheit:
   * Salsa Level 2“ ist kein Deutsch. Deshalb trägt die Tabelle den ganzen
   * Satzteil und nicht bloß einen Namen.
   */
  text: string;
  /**
   * Der Ursprung war die Kundenliste selbst. Dann gibt es genau einen Weg
   * zurück statt zweimal desselben Ziels — nur eben mit Filter und Suche.
   */
  istKundenliste: boolean;
};

type Eintrag = {
  muster: string;
  /** Der Satzteil hinter „Zurück “, etwa „zu den Buchungen“. */
  text: string;
  /**
   * Nur dieser Pfad, keine Unterseiten. `/admin` braucht das: Sonst erbte
   * jede unbekannte Verwaltungsseite den Namen „Übersicht“ und bekäme einen
   * Rückweg, den niemand gebaut hat. Der Unit-Test hält das fest.
   */
  genau?: boolean;
};

/**
 * Jede Stelle, die in die Kundenakte verlinkt, hat hier einen Namen. Ein Pfad
 * ohne Eintrag bekommt bewusst keinen Rückweg: Lieber der gewohnte Weg zur
 * Kundenliste als ein Link, der „Zurück zu /admin/ferien“ heißt.
 */
const TABELLE: Eintrag[] = [
  // Lehreransicht und Check-in. Die Anwesenheitsliste `/lehrer/<kursId>`
  // läuft nicht über diese Tabelle, sondern über die Kurs-ID weiter unten.
  { muster: "/lehrer", text: "zu meinen Kursen", genau: true },
  { muster: "/checkin", text: "zum Check-in" },
  // Verwaltung
  { muster: "/admin/barzahlungen", text: "zu den Barzahlungen" },
  { muster: "/admin/buchungen", text: "zu den Buchungen" },
  { muster: "/admin/events", text: "zu den Events" },
  { muster: "/admin/gasttaenzer", text: "zu den Gasttänzern" },
  { muster: "/admin/kuendigungen", text: "zu den Kündigungen" },
  { muster: "/admin/kurse", text: "zu den Kursen" },
  { muster: "/admin/lastschriften", text: "zu den Lastschriften" },
  { muster: "/admin/lehrer", text: "zu den Lehrerrollen" },
  { muster: "/admin/offene-posten", text: "zu den offenen Posten" },
  { muster: "/admin/probestunden", text: "zu den Probestunden" },
  { muster: "/admin/rechnungen", text: "zu den Rechnungen" },
  // Das Dashboard trägt Geburtstage und Upgrade-Anfragen.
  { muster: "/admin", text: "zur Übersicht", genau: true },
];

/**
 * Längstes Muster gewinnt, damit `/admin/lastschriften` nicht beim Eintrag
 * `/admin` hängenbleibt. Einmal sortiert, nicht bei jedem Aufruf.
 */
const SORTIERT = [...TABELLE].sort((a, b) => b.muster.length - a.muster.length);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ein langer Kursname darf den Kopf der Akte nicht auseinanderreißen. */
export function kuerze(text: string, hoechstens = 40): string {
  const sauber = text.trim();
  if (sauber.length <= hoechstens) return sauber;
  return `${sauber.slice(0, hoechstens - 1).trimEnd()}…`;
}

function pfadOhneSuche(pfad: string): string {
  return pfad.split(/[?#]/)[0];
}

/**
 * Der geprüfte Pfad oder null. `safeRedirectPath` bekommt einen leeren
 * Rückfall, weil hier „nicht vertrauenswürdig“ und „nicht angegeben“ dasselbe
 * Ergebnis haben sollen: kein benannter Rückweg.
 */
function geprueft(von: string | null | undefined): string | null {
  if (!von) return null;
  const pfad = safeRedirectPath(von, "");
  return pfad === "" ? null : pfad;
}

/**
 * Kommt der Klick aus der Anwesenheitsliste eines Kurses, steckt die Kurs-ID
 * im Pfad. Die Akte sieht damit den **echten** Namen nach, statt einen Text
 * aus der Adresse zu glauben.
 */
export function kursIdAusHerkunft(von: string | null | undefined): string | null {
  const pfad = geprueft(von);
  if (!pfad) return null;

  const teile = pfadOhneSuche(pfad).split("/").filter(Boolean);
  if (teile.length !== 2 || teile[0] !== "lehrer") return null;
  return UUID.test(teile[1]) ? teile[1] : null;
}

/**
 * Macht aus `?von=` einen Rückweg mit Namen — oder null, wenn es keinen geben
 * soll. Null heißt für die Akte: zeig den Standard, so wie vor PROJ-100.
 *
 * `kursName` wird nur für die Anwesenheitsliste gebraucht und von der Seite
 * nachgesehen. Fehlt er (gelöschter Kurs, nicht lesbar), bleibt der Rückweg
 * bei der Art der Seite statt einen leeren Namen zu zeigen.
 */
export function loeseHerkunftAuf(
  von: string | null | undefined,
  kursName?: string | null
): Herkunft | null {
  const pfad = geprueft(von);
  if (!pfad) return null;

  const nur = pfadOhneSuche(pfad);

  // Eine Kundenakte als Ursprung wäre ein Rückweg im Kreis — auch die eines
  // anderen Kunden, denn von dort führt kein Klick hierher.
  if (nur.startsWith(`${KUNDENLISTE}/`)) return null;

  // Die Kundenliste ist der Standard. Sie bekommt keinen zweiten Link, aber
  // ihren Suchteil: Wer aus einer gefilterten Liste kam, findet sie wieder.
  if (nur === KUNDENLISTE) {
    return { pfad, text: STANDARD_TEXT, istKundenliste: true };
  }

  // Die Anwesenheitsliste eines Kurses: der Name kommt aus der Datenbank,
  // nicht aus der Adresse. Fehlt er, bleibt der Rückweg bei der Art der Seite.
  if (kursIdAusHerkunft(pfad)) {
    const text = kursName ? `zur Anwesenheit: ${kuerze(kursName)}` : "zur Anwesenheitsliste";
    return { pfad, text, istKundenliste: false };
  }

  const treffer = SORTIERT.find((eintrag) =>
    eintrag.genau ? nur === eintrag.muster : nur === eintrag.muster || nur.startsWith(`${eintrag.muster}/`)
  );
  if (!treffer) return null;

  return { pfad, text: treffer.text, istKundenliste: false };
}

/**
 * Die Adresse der Kundenakte mit Ursprung. Eine Stelle für die Regel, damit
 * eine künftige Liste sie erbt und nicht neu erfindet.
 */
export function kundenakteMitHerkunft(kundeId: string, herkunft: string | null): string {
  const ziel = `${KUNDENLISTE}/${kundeId}`;
  if (!herkunft) return ziel;
  return `${ziel}?von=${encodeURIComponent(herkunft)}`;
}
