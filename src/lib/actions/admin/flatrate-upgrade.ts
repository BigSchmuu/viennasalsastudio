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
/**
 * Einen eingegebenen Differenzbetrag lesen — oder `null`.
 *
 * Anders als `betragAusEingabe` ist **null erlaubt**: Sie ist hier eine
 * Aussage („nichts dazu") und kein fehlender Wert. Leer heißt dagegen „nimm
 * den gerechneten Betrag".
 */
function differenzAusEingabe(eingabe: string): number | null | "ungueltig" {
  const sauber = eingabe.trim().replace(",", ".");
  if (sauber === "") return null;
  const zahl = Number(sauber);
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 10000) return "ungueltig";
  return Math.round(zahl * 100) / 100;
}

export async function confirmFlatrateUpgrade(
  subscriptionId: string,
  student: boolean,
  differenzEingabe?: string
): Promise<ActionResult> {
  await requireAdmin();

  let differenz: number | null = null;
  if (differenzEingabe !== undefined) {
    const gelesen = differenzAusEingabe(differenzEingabe);
    if (gelesen === "ungueltig") {
      return { error: "Bitte eine Differenz zwischen 0 und 10.000 € eingeben." };
    }
    differenz = gelesen;
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("confirm_flatrate_upgrade", {
    p_subscription_id: subscriptionId,
    p_student: student,
    p_differenz: differenz,
  });

  if (error) {
    if (error.message.includes("flatrate price missing")) {
      return { error: "In der Preisliste fehlt der Flatrate-Preis — bitte zuerst eintragen." };
    }
    if (error.message.includes("no open request")) {
      return { error: "Für dieses Abo liegt keine Anfrage mehr vor." };
    }
    if (error.message.includes("difference")) {
      return { error: "Die Differenz muss zwischen 0 und 10.000 € liegen." };
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
