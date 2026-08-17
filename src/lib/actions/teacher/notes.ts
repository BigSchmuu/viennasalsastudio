"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessionNoteSchema } from "@/lib/validations/teacher";
import type { ActionResult } from "@/lib/actions/types";

export async function saveSessionNote(formData: FormData): Promise<ActionResult> {
  const parsed = sessionNoteSchema.safeParse({
    course_id: formData.get("course_id"),
    occurrence_date: formData.get("occurrence_date"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_session_note", {
    p_course_id: parsed.data.course_id,
    p_occurrence_date: parsed.data.occurrence_date,
    p_note: parsed.data.note,
  });

  if (error) {
    return { error: "Notiz konnte nicht gespeichert werden." };
  }

  revalidatePath(`/lehrer/${parsed.data.course_id}/${parsed.data.occurrence_date}`);
  return { success: true };
}
