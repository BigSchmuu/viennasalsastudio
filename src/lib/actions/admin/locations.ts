"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { locationSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

export async function createLocation(formData: FormData): Promise<ActionResult> {
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("locations").insert({
    name: parsed.data.name,
    address: parsed.data.address || null,
    description: parsed.data.description || null,
  });

  if (error) {
    return { error: "Standort konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/standorte");
  return { success: true };
}

export async function updateLocation(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("locations")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      description: parsed.data.description || null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Standort konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/standorte");
  return { success: true };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    if (isForeignKeyRestrictError(error)) {
      return {
        error: "Dieser Standort kann nicht gelöscht werden, da ihm noch Räume zugeordnet sind.",
      };
    }
    return { error: "Standort konnte nicht gelöscht werden." };
  }

  revalidatePath("/admin/standorte");
  return { success: true };
}
