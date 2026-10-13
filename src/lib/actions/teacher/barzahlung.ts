"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Eine Barzahlung erfassen (PROJ-81).
 *
 * Der Betrag kommt **nicht** von hier, sondern aus dem Abo: Sonst könnte ein
 * Fehler in der Oberfläche eine falsche Summe festschreiben. Wer abhaken darf,
 * entscheidet die Datenbankfunktion — Lehrkraft dieses Kurses oder Verwaltung.
 */
export type BarzahlungErfasst = { error: string } | { success: true; zahlungId: string };

export async function erfasseBarzahlung(
  subscriptionId: string,
  courseId: string
): Promise<BarzahlungErfasst> {
  await requireAdminOrTeacher();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_cash_payment", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    // Die beiden Fälle, die am Kursabend vorkommen, bekommen einen eigenen Satz
    // — „Fehler beim Speichern" hilft niemandem, der Geld in der Hand hält.
    if (error.message.includes("already recorded")) {
      return { error: "Für diesen Zyklus ist schon eine Barzahlung erfasst." };
    }
    if (error.message.includes("no price")) {
      return { error: "Am Abo steht kein Preis — bitte in der Verwaltung ergänzen." };
    }
    console.error("Barzahlung nicht erfasst", subscriptionId, error);
    return { error: "Die Barzahlung konnte nicht erfasst werden." };
  }

  revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
  // Die Kennung geht zurück an die Oberfläche: Damit lässt sich ein Fehlgriff
  // sofort zurücknehmen, ohne die Seite neu zu laden.
  return { success: true, zahlungId: data.id };
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

  revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
  return { success: true };
}
