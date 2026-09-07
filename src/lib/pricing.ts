import type { DesiredPlan } from "@/lib/constants/booking";

/**
 * Die Preisliste des Studios (PROJ-41).
 *
 * Drop-in-Preise sind seit jeher gepflegt und daher immer vorhanden. Abo- und
 * Flatrate-Preise dürfen fehlen: die Spalten sind neu, und ein noch nicht
 * gepflegter Preis ist etwas anderes als ein Preis von 0 €. Deshalb `null`
 * statt eines stillen Nullwerts — wer nichts gepflegt hat, soll auch nichts
 * behaupten.
 */
export type StudioPricing = {
  dropin: { normal: number; student: number };
  course: { normal: number | null; student: number | null };
  flatrate: { normal: number | null; student: number | null };
  /**
   * Die beiden Empfehlungsbeträge (PROJ-44). Anders als die Abo-Preise nie
   * `null`: Bei einer Belohnung ist 0 die Aussage „das Programm ist aus", und
   * genau dafür gibt es das Feld — einen eigenen Schalter braucht es nicht.
   */
  referral: { referrer: number; referee: number };
};

/** Fallback, falls die Preiszeile fehlt — entspricht dem bisherigen Verhalten. */
export const DEFAULT_DROPIN_NORMAL = 20;
export const DEFAULT_DROPIN_STUDENT = 15;

type PricingRow = {
  normal_price?: number | null;
  student_price?: number | null;
  course_price?: number | null;
  course_student_price?: number | null;
  flatrate_price?: number | null;
  flatrate_student_price?: number | null;
  referral_reward_referrer?: number | null;
  referral_reward_referee?: number | null;
} | null;

/** Übersetzt die Datenbankzeile in die Preisliste — an genau einer Stelle. */
export function readStudioPricing(row: PricingRow): StudioPricing {
  return {
    dropin: {
      normal: row?.normal_price ?? DEFAULT_DROPIN_NORMAL,
      student: row?.student_price ?? DEFAULT_DROPIN_STUDENT,
    },
    course: {
      normal: row?.course_price ?? null,
      student: row?.course_student_price ?? null,
    },
    flatrate: {
      normal: row?.flatrate_price ?? null,
      student: row?.flatrate_student_price ?? null,
    },
    referral: {
      referrer: row?.referral_reward_referrer ?? 0,
      referee: row?.referral_reward_referee ?? 0,
    },
  };
}

/**
 * Der Preis, den ein Kunde für eine Abo-Art zahlt.
 *
 * Für "Nur diesen Kurs" gilt: ein eigener Kurspreis schlägt den Standard. Ein
 * leeres Preisfeld beim Kurs bedeutet dabei "Standard", nicht "kostenlos" —
 * deshalb wird `null` (und nur `null`) durch den Standard ersetzt, ein
 * eingetragenes 0 dagegen respektiert.
 *
 * Gibt `null` zurück, wenn kein Preis ermittelbar ist. Aufrufer zeigen dann
 * einen Hinweis statt "0,00 €".
 *
 * Diese Funktion ist die einzige Stelle, an der ein Abo-Preis entsteht: die
 * Kachel im Buchungsdialog und der Vorschlag im Bestätigungsdialog des
 * Betreibers fragen beide hier — zwei getrennte Rechenwege würden irgendwann
 * auseinanderlaufen, und dann sähe der Kunde etwas anderes als der Betreiber.
 */
export function planPrice(
  pricing: StudioPricing,
  plan: DesiredPlan,
  options: { coursePrice?: number | null; student?: boolean } = {}
): number | null {
  const student = options.student ?? false;

  if (plan === "flatrate") {
    const price = student ? pricing.flatrate.student : pricing.flatrate.normal;
    // Ist kein Studierendenpreis gepflegt, gilt der normale — eine fehlende
    // Ermäßigung darf nicht dazu führen, dass gar kein Preis erscheint.
    return price ?? pricing.flatrate.normal;
  }

  // Der Kurs-Einzelpreis gilt nur für den Normalpreis. Ein Studierender bekommt
  // den ermäßigten Standard: ein abweichender Kurspreis ist eine Aussage über
  // diesen Kurs, keine über die Ermäßigung.
  if (student) {
    return pricing.course.student ?? pricing.course.normal ?? options.coursePrice ?? null;
  }
  return options.coursePrice ?? pricing.course.normal;
}

/**
 * Sprachabhängige Schreibweise der BCP-47-Kennung.
 *
 * Für Englisch bewusst `en-IE`: englische Zahlenschreibweise, aber ein Land
 * mit Euro — daraus wird "€65.00" statt "€65.00" mit fremder Währungsstellung.
 */
const priceLocales: Record<string, string> = { de: "de-AT", en: "en-IE" };

/**
 * Einheitliche Preisdarstellung (PROJ-41, sprachabhängig seit PROJ-43).
 *
 * Ohne Angabe bleibt es bei der österreichischen Schreibweise — so bleibt die
 * Verwaltung unverändert, die durchgehend deutsch ist. Der Kundenbereich reicht
 * die aktive Sprache durch: "€ 65,00" auf Deutsch, "€65.00" auf Englisch. Der
 * Betrag bleibt in Euro, unabhängig davon, wer liest.
 */
export function formatPrice(price: number, locale: string = "de"): string {
  return price.toLocaleString(priceLocales[locale] ?? priceLocales.de, {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * Die Preisliste in einer Zeile, für die zugeklappte Kopfzeile.
 *
 * Sie soll den häufigsten Grund erledigen, überhaupt aufzuklappen: nachsehen,
 * was gerade eingestellt ist. Deshalb steht sie neben dem Aufklapper und nicht
 * darin.
 *
 * `null` heißt „noch nicht gepflegt" und wird als solches genannt — ein
 * ausgelassener Eintrag sähe aus wie ein vergessener, und „0 €" wäre schlicht
 * falsch. Bei den Empfehlungsbeträgen ist 0 dagegen eine Aussage: das
 * Programm ist aus.
 */
/**
 * Eingabe für {@link preisUeberblick}: wie {@link StudioPricing}, nur darf
 * überall `null` stehen. Das Formular zeigt die Übersicht aus den Feldern, die
 * gerade darin stehen — und ein geleertes Feld hat noch keine Zahl.
 */
export type PreisUeberblickEingabe = {
  dropin: { normal: number | null; student: number | null };
  course: { normal: number | null; student: number | null };
  flatrate: { normal: number | null; student: number | null };
  referral: { referrer: number | null; referee: number | null };
};

export function preisUeberblick(preise: PreisUeberblickEingabe, locale: string = "de"): string {
  const paar = (normal: number | null, student: number | null): string =>
    normal === null && student === null
      ? "nicht gepflegt"
      : `${normal === null ? "\u2014" : formatPrice(normal, locale)} / ${
          student === null ? "\u2014" : formatPrice(student, locale)
        }`;

  const teile = [
    `Drop-in ${paar(preise.dropin.normal, preise.dropin.student)}`,
    `Kursabo ${paar(preise.course.normal, preise.course.student)}`,
    `Flatrate ${paar(preise.flatrate.normal, preise.flatrate.student)}`,
    // Beide auf 0 heißt: das Empfehlungsprogramm ist abgeschaltet. Das gehört in
    // die Übersicht, sonst sucht man den Schalter, den es nicht gibt.
    preise.referral.referrer === 0 && preise.referral.referee === 0
      ? "Empfehlung aus"
      : `Empfehlung ${paar(preise.referral.referrer, preise.referral.referee)}`,
  ];

  return teile.join(" \u00b7 ");
}
