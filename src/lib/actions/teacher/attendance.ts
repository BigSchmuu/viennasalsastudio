"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markAttendanceSchema } from "@/lib/validations/teacher";
import type { ActionResult } from "@/lib/actions/types";

export async function markAttendance(formData: FormData): Promise<ActionResult> {
  const parsed = markAttendanceSchema.safeParse({
    course_id: formData.get("course_id"),
    customer_id: formData.get("customer_id"),
    occurrence_date: formData.get("occurrence_date"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", {
    p_course_id: parsed.data.course_id,
    p_customer_id: parsed.data.customer_id,
    p_occurrence_date: parsed.data.occurrence_date,
    p_status: parsed.data.status,
  });

  if (error) {
    if (error.message.includes("future date")) {
      return { error: "Anwesenheit kann nicht für einen zukünftigen Termin markiert werden." };
    }
    return { error: "Anwesenheit konnte nicht gespeichert werden." };
  }

  revalidatePath(`/lehrer/${parsed.data.course_id}`);
  return { success: true };
}
