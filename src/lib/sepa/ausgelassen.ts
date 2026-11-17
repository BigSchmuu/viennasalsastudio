import type { Ferienzeitraum } from "@/lib/scheduling/dates";
import { istFaellig, naechsteFaelligkeit, ZYKLUS_TAGE } from "@/lib/sepa/faelligkeit";

/**
 * Warum ein Lastschriftlauf ein Abo ausgelassen hat (PROJ-103).
 *
 * Bis hierher gab es die Regel zweimal: einmal beim Anlegen des Laufs, wo sie
 * zählte, und einmal auf der Seite des Entwurfs, wo sie Gründe aufschrieb.
 * Der Kommentar dort warnte selbst davor, dass zwei Regeln auseinanderlaufen —
 * und seit der Hinweis die Abos **namentlich** nennt, wäre das kein
 * Schönheitsfehler mehr, sondern eine Falschaussage über Geld.
 *
 * Deshalb steht die Regel jetzt hier, einmal, als Funktion über ein Abo. Sie
 * entscheidet nichts neu: Was ein Lauf aufnimmt, ist unverändert. Sie sagt
 * nur, **welcher** Grund es war — und das als Datenstruktur, nicht als Satz.
 * Der Satz entsteht erst in der Anzeige (`auslassText`), damit sich die
 * Reihenfolge der Gründe prüfen lässt, ohne Texte zu vergleichen.
 */

/** Was von einem Abo gebraucht wird, um es zu beurteilen. */
export type AboZumPruefen = {
  price: number | null;
  cycle_anchor_date: string;
  pending_status: string | null;
  pending_effective_date: string | null;
};

/**
 * Ein Zahlungszyklus des Studios (PROJ-107).
 *
 * Eingetragen, nicht gerechnet: `von` und `bis` sind beides Tage, die zum
 * Zyklus gehoeren. Liegt der Faelligkeitstag in einem solchen Zyklus, gilt die
 * neue Sperre; gibt es keinen, gilt weiter die Vier-Wochen-Rechnung aus
 * PROJ-70.
 */
export type Zyklus = { id: string; von: string; bis: string };

/**
 * Ein fruederer Einzug dieses Abos: der Faelligkeitstag des Laufs und der
 * Zyklus, fuer den dieser Lauf einzog.
 *
 * `zyklusId: null` heisst "Lauf aus der Zeit vor den Zyklen". Ein nackter
 * String wird genauso gelesen -- deshalb bleiben die aelteren Aufrufe gueltig,
 * und sie pruefen damit genau den Rueckfallweg.
 */
export type FruehererEinzug = { faellig: string; zyklusId: string | null };

export type AuslassGrund =
  /** Kündigung oder Pause wirkt zum Fälligkeitstag oder davor. */
  | { art: "aenderung_wirkt"; was: "paused" | "cancelled" | "unbekannt"; ab: string }
  /** Das Abo beginnt erst nach dem Fälligkeitstag (PROJ-71). */
  | { art: "beginnt_spaeter"; beginn: string }
  /** Ein früherer Einzug liegt im selben Zyklus (PROJ-70). */
  | { art: "zyklus_offen"; letzterEinzug: string; wiederAb: string }
  /** Ein Einzug mit **späterem** Datum liegt im selben Zyklus (PROJ-70). */
  | { art: "zyklus_vorgemerkt"; kuenftigerEinzug: string }
  /** In diesem eingetragenen Zyklus wurde schon eingezogen (PROJ-107). */
  | { art: "zyklus_eingezogen"; am: string; zyklusBis: string }
  /** Am Abo ist kein Preis hinterlegt — bis PROJ-103 fiel es lautlos aus jedem Lauf. */
  | { art: "kein_preis" };

export type AuslassArt = AuslassGrund["art"];

/**
 * Warum dieser Lauf das Abo auslässt — oder `null`, wenn er es aufnimmt.
 *
 * Treffen mehrere Gründe zu, gewinnt der entscheidendste. Die Reihenfolge ist
 * bewusst und wird vom Test festgehalten:
 *
 * 1. **Kündigung oder Pause wirkt** — zum Fälligkeitstag ist das kein
 *    laufendes Abo mehr; alles Weitere wäre gegenstandslos.
 * 2. **Beginnt später** — es gibt es noch nicht.
 * 3. **Zyklus noch nicht um** — es gibt es, aber es ist schon bezahlt.
 * 4. **Kein Preis** — es wäre fällig, aber der Betrag fehlt.
 *
 * Ein Abo ohne gültiges SEPA-Mandat kommt hier nicht an: Das ist ein
 * Barzahler, und der gehört nicht in einen Lastschriftlauf.
 */
export function auslassGrund(
  abo: AboZumPruefen,
  faelligkeitsdatum: string,
  bisherigeEinzuege: (string | FruehererEinzug)[] | undefined,
  ferien: Ferienzeitraum[],
  zyklus: Zyklus | null = null,
  zyklusTage: number = ZYKLUS_TAGE
): AuslassGrund | null {
  if (abo.pending_effective_date && abo.pending_effective_date <= faelligkeitsdatum) {
    const was =
      abo.pending_status === "cancelled" || abo.pending_status === "paused"
        ? abo.pending_status
        : "unbekannt";
    return { art: "aenderung_wirkt", was, ab: abo.pending_effective_date };
  }

  if (abo.cycle_anchor_date > faelligkeitsdatum) {
    return { art: "beginnt_spaeter", beginn: abo.cycle_anchor_date };
  }

  const einzuege = alsEinzuege(bisherigeEinzuege);
  const tage = einzuege.map((e) => e.faellig);

  if (zyklus) {
    // PROJ-107: Nicht mehr "liegen vier Wochen dazwischen", sondern "ist in
    // diesem Zyklus schon eingezogen worden". Das ist eine Ja/Nein-Frage ohne
    // Rechnung -- und sie beantwortet den Umstieg richtig: Ein Einzug zwoelf
    // Tage vorher, aber im **vorigen** Zyklus, sperrt nicht mehr.
    const imZyklus = einzuege.filter((e) => imSelbenZyklus(e, zyklus)).map((e) => e.faellig);
    imZyklus.sort();
    if (imZyklus[0]) {
      return { art: "zyklus_eingezogen", am: imZyklus[0], zyklusBis: zyklus.bis };
    }
  } else if (!istFaellig(faelligkeitsdatum, tage, ferien, zyklusTage)) {
    return zyklusGrund(faelligkeitsdatum, tage, ferien, zyklusTage);
  }

  if (abo.price === null) {
    return { art: "kein_preis" };
  }

  return null;
}

/** Ein nackter Fälligkeitstag ist ein Einzug ohne Zyklus. */
function alsEinzuege(einzuege: (string | FruehererEinzug)[] | undefined): FruehererEinzug[] {
  return (einzuege ?? []).map((e) =>
    typeof e === "string" ? { faellig: e, zyklusId: null } : e
  );
}

/**
 * Zählt dieser Einzug für diesen Zyklus?
 *
 * Zwei Fälle, und der zweite ist der wichtigere: Ein Lauf **ohne** Zyklus,
 * dessen Fälligkeitstag im Zeitraum liegt, hat für diesen Zeitraum schon
 * eingezogen — er stammt nur aus der Zeit vor der Umstellung. Ihn zu übergehen
 * wäre ein Doppeleinzug.
 */
function imSelbenZyklus(einzug: FruehererEinzug, zyklus: Zyklus): boolean {
  if (einzug.zyklusId) return einzug.zyklusId === zyklus.id;
  return einzug.faellig >= zyklus.von && einzug.faellig <= zyklus.bis;
}

/**
 * Welcher Einzug sperrt — und in welche Richtung.
 *
 * `istFaellig` sperrt in beide: Ein Einzug im selben Zyklus zählt, auch wenn
 * er **nach** dem neuen Fälligkeitstag liegt (in der Testdatenbank steht ein
 * Lauf im Jahr 2028). Von einem „letzten Einzug“ zu reden, der noch nicht
 * stattgefunden hat, wäre falsch — deshalb zwei Gründe.
 *
 * Genannt wird der nächstliegende sperrende Einzug in der Vergangenheit, denn
 * der erklärt die Sperre am anschaulichsten. Gibt es nur künftige, dann der
 * früheste davon.
 */
function zyklusGrund(
  faelligkeitsdatum: string,
  einzuege: string[],
  ferien: Ferienzeitraum[],
  zyklusTage: number
): AuslassGrund {
  const naechsteNachNeu = naechsteFaelligkeit(faelligkeitsdatum, ferien, zyklusTage);
  const sperrend = einzuege.filter(
    (einzug) =>
      !(faelligkeitsdatum >= naechsteFaelligkeit(einzug, ferien, zyklusTage) || einzug >= naechsteNachNeu)
  );

  const vergangen = sperrend.filter((e) => e <= faelligkeitsdatum).sort();
  const letzterEinzug = vergangen[vergangen.length - 1];
  if (letzterEinzug) {
    return {
      art: "zyklus_offen",
      letzterEinzug,
      wiederAb: naechsteFaelligkeit(letzterEinzug, ferien, zyklusTage),
    };
  }

  const kuenftig = sperrend.filter((e) => e > faelligkeitsdatum).sort();
  if (kuenftig[0]) {
    return { art: "zyklus_vorgemerkt", kuenftigerEinzug: kuenftig[0] };
  }

  // Nicht erreichbar: `istFaellig` war falsch, also sperrt mindestens einer.
  // Ein Grund ohne Datum ist trotzdem besser als ein Absturz auf einer Seite,
  // auf der es um Geld geht.
  return { art: "zyklus_offen", letzterEinzug: faelligkeitsdatum, wiederAb: naechsteNachNeu };
}

function tag(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-AT", { timeZone: "UTC" });
}

/**
 * Der Grund als Satz, für die Anzeige.
 *
 * Die Wortwahl bei „Einzug am … keine vier Wochen Abstand“ ist absichtlich die
 * von PROJ-70 — der Satz steht schon im Dialog „Position hinzufügen“, und der
 * Betreiber soll nicht zwei Formulierungen für dieselbe Sache lernen. Neu ist
 * nur der Tag, ab dem es wieder geht: Das ist die Angabe, nach der man sonst
 * rechnen müsste.
 */
export function auslassText(grund: AuslassGrund): string {
  switch (grund.art) {
    case "aenderung_wirkt":
      if (grund.was === "cancelled") {
        return `Gekündigt zum ${tag(grund.ab)} — ab diesem Tag wird nicht mehr eingezogen.`;
      }
      if (grund.was === "paused") {
        return `Pause ab ${tag(grund.ab)} — in der Pause wird nicht eingezogen.`;
      }
      return `Eine Änderung wirkt ab ${tag(grund.ab)} — bis dahin wird nicht eingezogen.`;
    case "beginnt_spaeter":
      return `Beginnt erst am ${tag(grund.beginn)} — nach diesem Fälligkeitstag.`;
    case "zyklus_offen":
      return `Einzug am ${tag(grund.letzterEinzug)} — keine vier Wochen Abstand; wieder möglich ab ${tag(grund.wiederAb)}.`;
    case "zyklus_vorgemerkt":
      return `Für den ${tag(grund.kuenftigerEinzug)} ist schon ein Einzug angelegt — derselbe Zyklus.`;
    case "zyklus_eingezogen":
      return `In diesem Zyklus schon eingezogen am ${tag(grund.am)} — der Zyklus läuft bis ${tag(grund.zyklusBis)}.`;
    case "kein_preis":
      return "Kein Preis am Abo hinterlegt — der Lauf kann keinen Betrag abbuchen.";
  }
}

/**
 * Ein Grund, der auf einen **Datenfehler** zeigt und nicht auf eine Regel.
 *
 * Die Anzeige hebt ihn hervor: Die anderen Gründe sind richtig so und brauchen
 * nur einen Blick; ein Abo ohne Preis fällt dagegen auf Dauer aus jedem Lauf.
 */
export function istDatenfehler(grund: AuslassGrund): boolean {
  return grund.art === "kein_preis";
}

const KURZ: Record<AuslassArt, string> = {
  aenderung_wirkt: "gekündigt oder pausiert",
  beginnt_spaeter: "beginnt erst später",
  zyklus_offen: "im selben Zyklus schon eingezogen",
  zyklus_vorgemerkt: "im selben Zyklus schon eingezogen",
  zyklus_eingezogen: "in diesem Zyklus schon eingezogen",
  kein_preis: "ohne hinterlegten Preis",
};

/**
 * Eine Zeile für den Fall, dass gar kein Lauf entsteht.
 *
 * Dort gibt es keine Seite, auf der die Abos stehen könnten (siehe Out of
 * Scope in PROJ-103) — aber eine Zahl ohne Grund war schon der Anlass für
 * dieses Vorhaben. Also wenigstens: wie viele, warum.
 */
export function auslassZusammenfassung(gruende: AuslassGrund[]): string {
  const anzahl = new Map<string, number>();
  for (const grund of gruende) {
    const text = KURZ[grund.art];
    anzahl.set(text, (anzahl.get(text) ?? 0) + 1);
  }
  return [...anzahl.entries()]
    .map(([text, n]) => `${n} ${n === 1 ? "Abo" : "Abos"} ${text}`)
    .join(", ");
}
