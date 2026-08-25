"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { MAX_PRICE } from "@/lib/validations/booking";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Guthaben von Hand vergeben oder abziehen (PROJ-44).
 *
 * Beide Richtungen über dieselbe Funktion: Wer vergeben kann, vertippt sich
 * irgendwann, und ohne Gegenstück bliebe der Fehler stehen.
 *
 * Die eigentlichen Regeln — Grund verpflichtend, kein negatives Guthaben —
 * stehen in der Datenbank, nicht hier. Diese Prüfungen sind nur dafür da, dem
 * Betreiber eine verständliche Meldung zu geben statt einer technischen.
 */
export async function adjustCustomerCredit(formData: FormData): Promise<ActionResult> {
  const customerId = String(formData.get("customer_id") ?? "");
  const richtung = String(formData.get("direction") ?? "grant");
  const betragRoh = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const grund = String(formData.get("reason") ?? "").trim();

  const betrag = Number(betragRoh);
  if (!betragRoh || Number.isNaN(betrag) || betrag <= 0) {
    return { error: "Bitte einen Betrag größer als 0 eingeben." };
  }
  if (betrag > MAX_PRICE) {
    return { error: `Der Betrag darf höchstens ${MAX_PRICE} € betragen.` };
  }
  if (!grund) {
    return { error: "Bitte einen Grund angeben." };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("grant_customer_credit", {
    p_customer_id: customerId,
    p_amount: richtung === "deduct" ? -betrag : betrag,
    p_reason: grund,
  });

  if (error) {
    if (error.message.includes("balance would go negative")) {
      return { error: "So viel Guthaben hat dieser Kunde nicht." };
    }
    if (error.message.includes("reason required")) {
      return { error: "Bitte einen Grund angeben." };
    }
    return { error: "Guthaben konnte nicht geändert werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  revalidatePath("/profil");
  return { success: true };
}
