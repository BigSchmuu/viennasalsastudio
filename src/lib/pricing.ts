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

/** Einheitliche Preisdarstellung (de-AT, z. B. "65,00 €"). */
export function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}
