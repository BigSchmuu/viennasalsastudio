"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ferienSchema } from "@/lib/validations/admin";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Studioweite Ferien (PROJ-51).
 *
 * Ein Eintrag statt vierzig: Dass das Studio zwischen Weihnachten und Neujahr
 * zu hat, stand bisher als einzelner Ausfalltag an jedem Kurs.
 *
 * Bewusst getrennt von den Ausfalltagen je Kurs (`course_schedule_pauses`):
 * Ein einzelner Abend, an dem der Lehrer krank ist, hat mit Weihnachten nichts
 * zu tun. Beide lassen einen Termin ausfallen, aber das Löschen der Ferien
 * darf keinen Ausfalltag mitnehmen, den jemand aus anderem Grund gesetzt hat.
 */
function aktualisiereAnsichten() {
  revalidatePath("/admin/ferien");
  revalidatePath("/stundenplan");
  // Ferien wirken auf jede Terminrechnung — auch auf die Seiten, die den
  // nächsten Kurs zeigen.
  revalidatePath("/mein-bereich");
  revalidatePath("/kurse");
}

export async function ferienAnlegen(formData: FormData): Promise<ActionResult> {
  const parsed = ferienSchema.safeParse({
    name: formData.get("name"),
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("studio_holidays").insert({
    name: parsed.data.name,
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
  });

  if (error) {
    return { error: "Ferien konnten nicht angelegt werden." };
  }

  aktualisiereAnsichten();
  return { success: true };
}

export async function ferienEntfernen(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("studio_holidays").delete().eq("id", id);

  if (error) {
    return { error: "Ferien konnten nicht entfernt werden." };
  }

  aktualisiereAnsichten();
  return { success: true };
}
