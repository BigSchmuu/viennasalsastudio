"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { danceStyleSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

export async function createDanceStyle(formData: FormData): Promise<ActionResult> {
  const parsed = danceStyleSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("dance_styles").insert({ name: parsed.data.name });

  if (error) {
    if (error.code === "23505") {
      return { error: "Dieser Tanzstil existiert bereits." };
    }
    return { error: "Tanzstil konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/tanzstile");
  revalidatePath("/admin/kurse");
  return { success: true };
}

export async function updateDanceStyle(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = danceStyleSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("dance_styles")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Dieser Tanzstil existiert bereits." };
    }
    return { error: "Tanzstil konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/tanzstile");
  revalidatePath("/admin/kurse");
  return { success: true };
}

export async function deleteDanceStyle(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("dance_styles").delete().eq("id", id);

  if (error) {
    if (isForeignKeyRestrictError(error)) {
      return {
        error: "Dieser Tanzstil kann nicht gelöscht werden, da er noch bei Kursen verwendet wird.",
      };
    }
    return { error: "Tanzstil konnte nicht gelöscht werden." };
  }

  revalidatePath("/admin/tanzstile");
  return { success: true };
}
