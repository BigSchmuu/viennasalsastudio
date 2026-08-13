"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/lib/actions/auth";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    birthdate: formData.get("birthdate"),
    gender: formData.get("gender"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name || null,
      phone: parsed.data.phone || null,
      birthdate: parsed.data.birthdate || null,
      gender: parsed.data.gender || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Profil konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/profil");
  return { success: true };
}
