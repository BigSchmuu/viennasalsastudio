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
    content_video_url: formData.get("content_video_url"),
    teacher_ids: formData.getAll("teacher_ids"),
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

async function syncMaterial(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  videoUrl: string
) {
  if (videoUrl) {
    await supabase
      .from("course_materials")
      .upsert({ course_id: courseId, content_video_url: videoUrl });
  } else {
    await supabase.from("course_materials").delete().eq("course_id", courseId);
  }
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
  await syncMaterial(supabase, data.id, parsed.data.content_video_url ?? "");

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
    })
    .eq("id", id);

  if (error) {
    return { error: "Kurs konnte nicht gespeichert werden." };
  }

  const teacherResult = await syncTeachers(supabase, id, parsed.data.teacher_ids ?? []);
  if (teacherResult.error) {
    return { error: teacherResult.error };
  }
  await syncMaterial(supabase, id, parsed.data.content_video_url ?? "");

  revalidatePath("/admin/kurse");
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
