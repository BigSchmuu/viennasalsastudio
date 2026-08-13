"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { videoSetSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

export async function createVideoSet(formData: FormData): Promise<ActionResult> {
  const parsed = videoSetSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("video_sets").insert({
    name: parsed.data.name,
    level: parsed.data.level || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ein Videosatz mit diesem Namen existiert bereits." };
    }
    return { error: "Videosatz konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/videosaetze");
  revalidatePath("/admin/kurse");
  return { success: true };
}

export async function updateVideoSet(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = videoSetSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("video_sets")
    .update({ name: parsed.data.name, level: parsed.data.level || null })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ein Videosatz mit diesem Namen existiert bereits." };
    }
    return { error: "Videosatz konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/videosaetze");
  revalidatePath("/admin/kurse");
  return { success: true };
}

export async function deleteVideoSet(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("video_sets").delete().eq("id", id);

  if (error) {
    if (isForeignKeyRestrictError(error)) {
      return {
        error: "Dieser Videosatz kann nicht gelöscht werden, da er noch bei Kursen verwendet wird.",
      };
    }
    return { error: "Videosatz konnte nicht gelöscht werden." };
  }

  revalidatePath("/admin/videosaetze");
  return { success: true };
}
