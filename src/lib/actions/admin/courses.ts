"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { courseSchema } from "@/lib/validations/admin";
import { isForeignKeyRestrictError, type ActionResult } from "@/lib/actions/types";

function parseCourseFormData(formData: FormData) {
  return courseSchema.safeParse({
    name: formData.get("name"),
    dance_style_id: formData.get("dance_style_id"),
    level: formData.get("level"),
    room_id: formData.get("room_id"),
    video_set_id: formData.get("video_set_id"),
    teacher_ids: formData.getAll("teacher_ids"),
    max_participants: formData.get("max_participants"),
    price: formData.get("price"),
    prerequisite_note: formData.get("prerequisite_note"),
  });
}

async function syncTeachers(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  teacherIds: string[]
): Promise<{ error?: string }> {
  if (teacherIds.length > 0) {
    // Defense in depth: only allow ids that actually belong to teacher
    // profiles, even though the UI only ever offers real teachers.
    const { data: validTeachers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "teacher")
      .in("id", teacherIds);

    if ((validTeachers?.length ?? 0) !== teacherIds.length) {
      return { error: "Einer der ausgewählten Lehrer ist ungültig." };
    }
  }

  await supabase.from("course_teachers").delete().eq("course_id", courseId);
  if (teacherIds.length > 0) {
    await supabase
      .from("course_teachers")
      .insert(teacherIds.map((teacher_id) => ({ course_id: courseId, teacher_id })));
  }

  return {};
}

export async function createCourse(formData: FormData): Promise<ActionResult> {
  const parsed = parseCourseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      name: parsed.data.name,
      dance_style_id: parsed.data.dance_style_id,
      level: parsed.data.level,
      room_id: parsed.data.room_id,
      video_set_id: parsed.data.video_set_id || null,
      max_participants: parsed.data.max_participants ? Number(parsed.data.max_participants) : null,
      price: parsed.data.price ? Number(parsed.data.price) : null,
      prerequisite_note: parsed.data.prerequisite_note || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Kurs konnte nicht angelegt werden." };
  }

  const teacherResult = await syncTeachers(supabase, data.id, parsed.data.teacher_ids ?? []);
  if (teacherResult.error) {
    return { error: teacherResult.error };
  }

  revalidatePath("/admin/kurse");
  return { success: true };
}

export async function updateCourse(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseCourseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("courses")
    .update({
      name: parsed.data.name,
      dance_style_id: parsed.data.dance_style_id,
      level: parsed.data.level,
      room_id: parsed.data.room_id,
      video_set_id: parsed.data.video_set_id || null,
      max_participants: parsed.data.max_participants ? Number(parsed.data.max_participants) : null,
      price: parsed.data.price ? Number(parsed.data.price) : null,
      prerequisite_note: parsed.data.prerequisite_note || null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Kurs konnte nicht gespeichert werden." };
  }

  const teacherResult = await syncTeachers(supabase, id, parsed.data.teacher_ids ?? []);
  if (teacherResult.error) {
    return { error: teacherResult.error };
  }

  // A capacity increase may free up spots — re-check the waitlist for this
  // course. Harmless no-op if capacity wasn't raised or the waitlist is empty.
  const { error: promoteError } = await supabase.rpc("promote_waitlist_for_course", {
    p_course_id: id,
  });
  if (promoteError) {
    console.error("promote_waitlist_for_course failed", promoteError);
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/admin/buchungen");
  return { success: true };
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("courses").delete().eq("id", id);

  if (error) {
    if (isForeignKeyRestrictError(error)) {
      return {
        error: "Dieser Kurs kann nicht gelöscht werden, da ihm noch Termine oder Buchungen zugeordnet sind.",
      };
    }
    return { error: "Kurs konnte nicht gelöscht werden." };
  }

  revalidatePath("/admin/kurse");
  return { success: true };
}
