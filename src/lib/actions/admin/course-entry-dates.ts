"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { courseEntryDateSchema } from "@/lib/validations/booking";

type EntryDateResult = { error: string } | { success: true; entryDate: { id: string; entryDate: string } };
type SimpleResult = { error: string } | { success: true };

export async function addCourseEntryDate(courseId: string, formData: FormData): Promise<EntryDateResult> {
  const parsed = courseEntryDateSchema.safeParse({
    entry_date: formData.get("entry_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("course_entry_dates")
    .insert({ course_id: courseId, entry_date: parsed.data.entry_date })
    .select("id, entry_date")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Dieser Einstiegstermin existiert bereits." };
    }
    return { error: "Einstiegstermin konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/kurse");
  return { success: true, entryDate: { id: data.id, entryDate: data.entry_date } };
}

export async function deleteCourseEntryDate(entryDateId: string): Promise<SimpleResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("course_entry_dates").delete().eq("id", entryDateId);

  if (error) {
    return { error: "Einstiegstermin konnte nicht entfernt werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/kurse");
  return { success: true };
}
