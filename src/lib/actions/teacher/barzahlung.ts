"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import { betragAusEingabe } from "@/lib/kunden/offline";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Eine Barzahlung erfassen (PROJ-81, Teilbeträge ab PROJ-83).
 *
 * Ohne Betrag nimmt die Datenbank den **gesamten** offenen Saldo — der häufige
 * Fall bleibt ein Druck. Mit Betrag wird genau dieser verbucht; die Grenzen
 * (positiv, höchstens 10.000) stehen in `betragAusEingabe` und ein zweites Mal
 * in der Datenbank, denn eine Oberfläche ist keine Zusicherung.
 *
 * Wer erfassen darf, entscheidet die Datenbankfunktion: Lehrkraft eines Kurses
 * mit diesem Abo — oder Verwaltung.
 */
export type BarzahlungErfasst =
  | { error: string }
  // Der verbuchte Betrag kommt mit zurück: Ohne Eingabe hat ihn die Datenbank
  // aus dem Saldo bestimmt, und die Liste soll ihn anzeigen, ohne ihn zu
  // erraten.
  | { success: true; zahlungId: string; betrag: number };

export async function erfasseBarzahlung(
  subscriptionId: string,
  courseId: string,
  betragEingabe?: string
): Promise<BarzahlungErfasst> {
  await requireAdminOrTeacher();

  let betrag: number | null = null;
  if (betragEingabe !== undefined && betragEingabe.trim() !== "") {
    betrag = betragAusEingabe(betragEingabe);
    if (betrag === null) {
      return { error: "Bitte einen Betrag zwischen 0,01 und 10.000 € eingeben." };
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_cash_payment", {
    p_subscription_id: subscriptionId,
    p_amount: betrag,
  });

  if (error) {
    // Die Fälle, die am Kursabend vorkommen, bekommen einen eigenen Satz —
    // „Fehler beim Speichern" hilft niemandem, der Geld in der Hand hält.
    if (error.message.includes("just recorded")) {
      return { error: "Diese Zahlung ist gerade schon erfasst worden." };
    }
    if (error.message.includes("nothing open")) {
      return { error: "Für dieses Abo ist nichts offen." };
    }
    if (error.message.includes("no price")) {
      return { error: "Am Abo steht kein Preis — bitte in der Verwaltung ergänzen." };
    }
    if (error.message.includes("amount too high")) {
      return { error: "Der Betrag ist zu hoch — höchstens 10.000 €." };
    }
    console.error("Barzahlung nicht erfasst", subscriptionId, error);
    return { error: "Die Barzahlung konnte nicht erfasst werden." };
  }

  if (courseId) revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
  // Die Kennung geht zurück an die Oberfläche: Damit lässt sich ein Fehlgriff
  // sofort zurücknehmen, ohne die Seite neu zu laden.
  return { success: true, zahlungId: data.id, betrag: Number(data.amount) };
}

/**
 * Eine Barzahlung zurücknehmen.
 *
 * Für die Lehrkraft nur am selben Tag — das prüft die Datenbank. Ein Fehlgriff
 * fällt sofort auf; was älter ist, gehört in die Verwaltung, sonst verschwindet
 * Geld aus der Aufzeichnung, das längst eingesammelt wurde.
 */
export async function nimmBarzahlungZurueck(
  paymentId: string,
  courseId: string
): Promise<ActionResult> {
  await requireAdminOrTeacher();
  const supabase = await createClient();

  const { error } = await supabase.rpc("undo_cash_payment", { p_payment_id: paymentId });

  if (error) {
    if (error.message.includes("only todays payment")) {
      return { error: "Nur eine heute erfasste Zahlung lässt sich hier zurücknehmen." };
    }
    console.error("Barzahlung nicht zurückgenommen", paymentId, error);
    return { error: "Die Barzahlung konnte nicht zurückgenommen werden." };
  }

  if (courseId) revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
  return { success: true };
}
