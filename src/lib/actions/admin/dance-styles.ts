"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { danceStyleSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

/**
 * PROJ-93: Leeres Feld heisst `null` — „keinen Pass für diese Stilrichtung".
 * Ein stiller Nullwert wäre ein Pass zum Preis von null.
 */
function passPreis(wert: FormDataEntryValue | null): number | null {
  const text = String(wert ?? "").trim();
  return text === "" ? null : Number(text);
}

export async function createDanceStyle(formData: FormData): Promise<ActionResult> {
  const parsed = danceStyleSchema.safeParse({
    name: formData.get("name"),
    pass_price: formData.get("pass_price") ?? "",
    pass_student_price: formData.get("pass_student_price") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("dance_styles").insert({
    name: parsed.data.name,
    pass_price: passPreis(formData.get("pass_price")),
    pass_student_price: passPreis(formData.get("pass_student_price")),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Dieser Tanzstil existiert bereits." };
    }
    return { error: "Tanzstil konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/tanzstile");
  revalidatePath("/admin/kurse");
  // PROJ-93: Am Preis hängt die Pass-Kachel im Kundenbereich.
  revalidatePath("/kurse");
  revalidatePath("/stundenplan");
  return { success: true };
}

export async function updateDanceStyle(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = danceStyleSchema.safeParse({
    name: formData.get("name"),
    pass_price: formData.get("pass_price") ?? "",
    pass_student_price: formData.get("pass_student_price") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("dance_styles")
    .update({
      name: parsed.data.name,
      pass_price: passPreis(formData.get("pass_price")),
      pass_student_price: passPreis(formData.get("pass_student_price")),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Dieser Tanzstil existiert bereits." };
    }
    return { error: "Tanzstil konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/tanzstile");
  revalidatePath("/admin/kurse");
  // PROJ-93: Am Preis hängt die Pass-Kachel im Kundenbereich.
  revalidatePath("/kurse");
  revalidatePath("/stundenplan");
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
