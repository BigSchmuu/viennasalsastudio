"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";

type Ergebnis = { error: string } | { success: true };

/**
 * Die zweite Stufe eines anderen Verwaltungskontos entfernen (PROJ-58).
 *
 * Der Weg zurück, wenn jemand sein Handy verloren hat. Zurücksetzen allein
 * öffnet nichts — das Passwort braucht man weiterhin, und beim nächsten
 * Anmelden führt der Weg zur Einrichtung.
 */
export async function zweiteStufeZuruecksetzen(kontoId: string): Promise<Ergebnis> {
  const { supabase, user } = await requireAdmin();

  // Sonst ließe sich die Pflicht mit einem Klick abschalten.
  if (kontoId === user.id) {
    return { error: "Die eigene zweite Stufe lässt sich nicht zurücksetzen." };
  }

  const { data: konto } = await supabase.from("profiles").select("role, full_name").eq("id", kontoId).maybeSingle();

  if (konto?.role !== "admin") {
    return { error: "Nur Verwaltungskonten haben eine zweite Stufe." };
  }

  const admin = createAdminClient();
  const { data: faktoren, error: leseFehler } = await admin.auth.admin.mfa.listFactors({ userId: kontoId });

  if (leseFehler) {
    console.error("Faktoren konnten nicht gelesen werden", leseFehler);
    return { error: "Die zweite Stufe konnte nicht gelesen werden. Bitte versuche es erneut." };
  }

  for (const faktor of faktoren?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: faktor.id, userId: kontoId });
    if (error) {
      console.error("Faktor konnte nicht entfernt werden", error);
      return { error: "Die zweite Stufe konnte nicht entfernt werden. Bitte versuche es erneut." };
    }
  }

  // Ohne diesen Schritt liefe eine bereits offene Sitzung des Betroffenen
  // weiter, obwohl ihr Nachweis gerade entfernt wurde — und genau das wäre bei
  // einem Verdachtsfall der Grund, überhaupt zurückzusetzen.
  const { error: sitzungsFehler } = await supabase.rpc("admin_sitzungen_beenden", { p_user_id: kontoId });
  if (sitzungsFehler) {
    console.error("Sitzungen konnten nicht beendet werden", sitzungsFehler);
  }

  const { data: ichSelbst } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  await enqueueAndDispatch({
    customerId: kontoId,
    eventType: "zweite_stufe_zurueckgesetzt",
    payload: { durch_name: ichSelbst?.full_name ?? null, am: new Date().toISOString() },
    // Mit Zeitstempel im Schlüssel: Ein zweites Zurücksetzen ist ein zweites
    // Ereignis und gehört gemeldet, nicht als Dublette verworfen.
    dedupeKey: `zweite_stufe_zurueckgesetzt:${kontoId}:${Date.now()}`,
  });

  revalidatePath(`/admin/kunden/${kontoId}`);
  return { success: true };
}
