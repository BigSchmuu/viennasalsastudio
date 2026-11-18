"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { zyklusSchema } from "@/lib/validations/sepa";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Die Zahlungszyklen des Studios (PROJ-107).
 *
 * Die Regeln liegen in der Datenbank, nicht hier: Kein Tag gehört zu zwei
 * Zyklen, und ein Zyklus mit Lastschriftlauf ist unveränderlich. Diese Datei
 * übersetzt deren Meldungen in Sätze — und nennt dabei den Weg zurück, damit
 * niemand im SQL-Editor nachsehen muss.
 *
 * Eine **Lücke** wird bewusst nicht verhindert. Sie ist unerwünscht, aber
 * beherrschbar: Ein Fälligkeitstag ohne Zyklus fällt auf die Vier-Wochen-Regel
 * zurück, und die Seite des Laufs sagt das. Das Formular belegt den ersten Tag
 * lückenlos vor und warnt, wenn der Betreiber davon abweicht — vorschlagen
 * statt verbieten.
 */

const MELDUNGEN: [string, string][] = [
  [
    "overlaps an existing one",
    "Dieser Zeitraum überschneidet einen bestehenden Zyklus. Kein Tag darf zu zwei Zyklen gehören.",
  ],
  ["ends before it starts", "Der letzte Tag liegt vor dem ersten."],
  [
    "shorter than four course weeks",
    "Dieser Zeitraum ist kürzer als vier Kurswochen (28 Tage). Prüfe den letzten Tag.",
  ],
  [
    "longer than twelve weeks",
    "Dieser Zeitraum ist länger als zwölf Wochen (84 Tage) — meist ist dann die Jahreszahl verrutscht. Prüfe erster und letzter Tag.",
  ],
  [
    "has collection runs",
    "Zu diesem Zyklus gibt es schon einen Lastschriftlauf. Verwirf zuerst dessen Entwurf — sonst änderte sich im Nachhinein, wofür jemand bezahlt hat.",
  ],
];

function alsSatz(meldung: string | undefined, ersatz: string): string {
  for (const [kennung, satz] of MELDUNGEN) {
    if (meldung?.includes(kennung)) return satz;
  }
  return ersatz;
}

function aktualisiereAnsichten() {
  revalidatePath("/admin/zyklen");
  // Am Zyklus hängt, was ein Lauf aufnimmt.
  revalidatePath("/admin/lastschriften");
}

export async function legeZyklusAn(formData: FormData): Promise<ActionResult> {
  const parsed = zyklusSchema.safeParse({
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("billing_cycles").insert({
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    created_by: user.id,
  });

  if (error) {
    return { error: alsSatz(error.message, "Der Zyklus konnte nicht angelegt werden.") };
  }

  aktualisiereAnsichten();
  return { success: true };
}

export async function aendereZyklus(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = zyklusSchema.safeParse({
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("billing_cycles")
    .update({ starts_on: parsed.data.starts_on, ends_on: parsed.data.ends_on })
    .eq("id", id)
    .select("id");

  if (error) {
    return { error: alsSatz(error.message, "Der Zyklus konnte nicht geändert werden.") };
  }
  // Keine Zeile getroffen heißt: Es gibt ihn nicht mehr. Still durchzugehen
  // wäre hier die falsche Antwort — der Betreiber hält die Änderung sonst für
  // gespeichert.
  if (!data || data.length === 0) {
    return { error: "Diesen Zyklus gibt es nicht (mehr). Bitte lade die Seite neu." };
  }

  aktualisiereAnsichten();
  return { success: true };
}

export async function entferneZyklus(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("billing_cycles")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return { error: alsSatz(error.message, "Der Zyklus konnte nicht entfernt werden.") };
  }
  if (!data || data.length === 0) {
    return { error: "Diesen Zyklus gibt es nicht (mehr). Bitte lade die Seite neu." };
  }

  aktualisiereAnsichten();
  return { success: true };
}
