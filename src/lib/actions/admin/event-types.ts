"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { eventTypeSchema } from "@/lib/validations/events";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

/**
 * Eventarten verwalten (PROJ-53) — nach dem Muster der Tanzstile.
 *
 * Der Name erscheint im öffentlichen Programm (Label, Filter), deshalb wird
 * nach jeder Änderung auch die Übersicht neu geladen, nicht nur der Admin.
 */
function neuLaden() {
  revalidatePath("/admin/eventarten");
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function createEventType(formData: FormData): Promise<ActionResult> {
  const parsed = eventTypeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("event_types").insert({ name: parsed.data.name });

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Eventart gibt es schon." };
    }
    return { error: "Eventart konnte nicht angelegt werden." };
  }

  neuLaden();
  return { success: true };
}

export async function updateEventType(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = eventTypeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("event_types").update({ name: parsed.data.name }).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Eventart gibt es schon." };
    }
    return { error: "Eventart konnte nicht gespeichert werden." };
  }

  neuLaden();
  return { success: true };
}

export async function deleteEventType(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("event_types").delete().eq("id", id);

  if (error) {
    // Die Verwaltung sperrt das Löschen schon, solange Events zugeordnet sind.
    // Diese Meldung greift, wenn zwischen Anzeige und Klick eines dazukam —
    // die Datenbank lässt es dann nicht zu.
    if (isForeignKeyRestrictError(error)) {
      return { error: "Diese Eventart wird noch von Events verwendet und kann nicht gelöscht werden." };
    }
    return { error: "Eventart konnte nicht gelöscht werden." };
  }

  neuLaden();
  return { success: true };
}
