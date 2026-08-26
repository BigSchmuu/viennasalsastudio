"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueNotification } from "@/lib/notifications/dispatch";
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
  const benachrichtigen = formData.get("notify") === "true";

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
  // Liefert die angelegte Zeile — ihre id bindet die Benachrichtigung an
  // genau diese Gutschrift.
  const { data: zeile, error } = await supabase.rpc("grant_customer_credit", {
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

  // Ein Abzug löst nie eine Nachricht aus: Er korrigiert einen Fehler des
  // Betreibers, und dem Kunden mitzuteilen, dass ihm etwas weggenommen wurde,
  // das er nie hätte haben sollen, schafft nur Verwirrung.
  if (benachrichtigen && richtung !== "deduct" && zeile) {
    const { data: stand } = await supabase.rpc("customer_credit_balance", {
      p_customer_id: customerId,
    });
    await enqueueNotification({
      customerId,
      eventType: "guthaben",
      // Der Grund steht in der Nachricht — eine Gutschrift ohne Anlass wirft
      // mehr Fragen auf, als sie beantwortet.
      payload: { sub_type: "manual", amount: betrag, balance: Number(stand ?? betrag), reason: grund },
      // An die Gutschrift gebunden, nicht an den Kunden: Wer zweimal etwas
      // gutschreibt, meint auch zwei Nachrichten.
      dedupeKey: `guthaben_manuell:${zeile.id}`,
    });
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  revalidatePath("/profil");
  return { success: true };
}
