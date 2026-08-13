"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { roomSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

export async function createRoom(formData: FormData): Promise<ActionResult> {
  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    location_id: formData.get("location_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("rooms").insert({
    name: parsed.data.name,
    location_id: parsed.data.location_id,
  });

  if (error) {
    return { error: "Raum konnte nicht angelegt werden." };
  }

  revalidatePath(`/admin/standorte/${parsed.data.location_id}`);
  return { success: true };
}

export async function updateRoom(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    location_id: formData.get("location_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("rooms")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    return { error: "Raum konnte nicht gespeichert werden." };
  }

  revalidatePath(`/admin/standorte/${parsed.data.location_id}`);
  return { success: true };
}

export async function deleteRoom(id: string, locationId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("rooms").delete().eq("id", id);

  if (error) {
    if (isForeignKeyRestrictError(error)) {
      return {
        error: "Dieser Raum kann nicht gelöscht werden, da ihm noch Kurse zugeordnet sind.",
      };
    }
    return { error: "Raum konnte nicht gelöscht werden." };
  }

  revalidatePath(`/admin/standorte/${locationId}`);
  return { success: true };
}
