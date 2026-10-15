"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Ein Upgrade bestätigen oder ablehnen (PROJ-87).
 *
 * Die Bestätigung tut alles zusammen oder nichts: Kurs weg, Preis neu,
 * Kursplatz daneben, Aufschlag festgehalten, Markierung gelöscht, Kunde
 * benachrichtigt. Deshalb steckt der ganze Vorgang in einer
 * Datenbankfunktion und nicht in fünf Aufrufen hintereinander — ein halb
 * vollzogenes Upgrade wäre ein Abo ohne Kurs und ohne Kursplatz, und der
 * Kunde stünde in keinem Kurs mehr.
 *
 * Der Tarif ist die einzige Entscheidung, die hier getroffen wird: normal oder
 * Studierende. Beide Preise stehen in der Preisliste (PROJ-41); eine
 * Sonderabsprache trägt der Betreiber danach am Abo ein, wo er es immer tut.
 */
export async function confirmFlatrateUpgrade(
  subscriptionId: string,
  student: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("confirm_flatrate_upgrade", {
    p_subscription_id: subscriptionId,
    p_student: student,
  });

  if (error) {
    if (error.message.includes("flatrate price missing")) {
      return { error: "In der Preisliste fehlt der Flatrate-Preis — bitte zuerst eintragen." };
    }
    if (error.message.includes("no open request")) {
      return { error: "Für dieses Abo liegt keine Anfrage mehr vor." };
    }
    if (error.message.includes("upgrade not possible")) {
      return {
        error:
          "Dieses Abo erfüllt die Voraussetzungen nicht mehr — etwa weil inzwischen gekündigt wurde.",
      };
    }
    console.error("Upgrade nicht bestätigt", subscriptionId, error);
    return { error: "Das Upgrade konnte nicht bestätigt werden." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/kunden`);
  return { success: true };
}

export async function declineFlatrateUpgrade(subscriptionId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("decline_flatrate_upgrade", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    console.error("Upgrade nicht abgelehnt", subscriptionId, error);
    return { error: "Die Anfrage konnte nicht abgelehnt werden." };
  }

  revalidatePath("/admin");
  return { success: true };
}
