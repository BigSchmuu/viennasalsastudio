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
    role_query_enabled: formData.get("role_query_enabled") === "true",
    max_role_difference: formData.get("max_role_difference"),
  });
}

async function syncTeachers(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
  teacherIds: string[]
): Promise<{ error?: string }> {
  // Nur Personen, die unterrichten dürfen — auch wenn die Auswahlliste ohnehin
  // nur solche anbietet. Seit PROJ-40 zählt dazu auch ein Admin: Wer das Studio
  // führt und selbst unterrichtet, soll kein zweites Konto brauchen.
  //
  // Ungültige Kennungen werden **verworfen**, nicht abgelehnt. Vorher scheiterte
  // das Speichern am ganzen Satz, sobald eine einzige Zuweisung nicht mehr galt
  // — und genau das passiert regelmäßig: PROJ-22 stuft eine Lehrkraft zurück und
  // lässt ihre Kurszuweisungen bewusst stehen („Zuordnungen automatisch zu
  // löschen wäre stiller Datenverlust"). Das Kursformular schickt beim Speichern
  // aber alle bestehenden Zuweisungen mit, und die zurückgestufte Person steht
  // nicht mehr in der Auswahlliste — sie war ausgewählt, aber unsichtbar. Der
  // Kurs liess sich damit nie wieder speichern, und niemand konnte es beheben.
  //
  // Der Schutz bleibt: Wer nicht unterrichten darf, wird nicht zugewiesen. Nur
  // legt er jetzt nicht mehr den ganzen Kurs lahm.
  let gueltigeIds = teacherIds;
  if (teacherIds.length > 0) {
    const { data: validTeachers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["teacher", "admin"])
      .in("id", teacherIds);

    const erlaubt = new Set((validTeachers ?? []).map((p) => p.id));
    gueltigeIds = teacherIds.filter((id) => erlaubt.has(id));
  }

  await supabase.from("course_teachers").delete().eq("course_id", courseId);
  if (gueltigeIds.length > 0) {
    await supabase
      .from("course_teachers")
      .insert(gueltigeIds.map((teacher_id) => ({ course_id: courseId, teacher_id })));
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
      role_query_enabled: parsed.data.role_query_enabled ?? false,
      max_role_difference: parsed.data.max_role_difference ? Number(parsed.data.max_role_difference) : null,
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
      role_query_enabled: parsed.data.role_query_enabled ?? false,
      max_role_difference: parsed.data.max_role_difference ? Number(parsed.data.max_role_difference) : null,
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
