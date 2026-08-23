"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { courseScheduleSchema, schedulePauseSchema } from "@/lib/validations/admin";

type ScheduleResult =
  | { error: string }
  | { success: true; schedule: { id: string; weekday: number; startTime: string; endTime: string } };

// PROJ-38: notifiedAt kommt mit, damit die frisch angelegte Pause in der Liste
// denselben Zustand hat wie eine neu geladene — sie ist naturgemäß noch nicht
// benachrichtigt, denn das Eintragen verschickt bewusst nichts.
type PauseResult =
  | { error: string }
  | { success: true; pause: { id: string; pauseDate: string; notifiedAt: string | null } };
type SimpleResult = { error: string } | { success: true };

export async function upsertCourseSchedule(courseId: string, formData: FormData): Promise<ScheduleResult> {
  const parsed = courseScheduleSchema.safeParse({
    weekday: formData.get("weekday"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("course_schedule")
    .upsert(
      {
        course_id: courseId,
        weekday: Number(parsed.data.weekday),
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
      },
      { onConflict: "course_id" }
    )
    .select("id, weekday, start_time, end_time")
    .single();

  if (error || !data) {
    return { error: "Wochentermin konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/stundenplan");
  return {
    success: true,
    schedule: { id: data.id, weekday: data.weekday, startTime: data.start_time, endTime: data.end_time },
  };
}

export async function deleteCourseSchedule(scheduleId: string): Promise<SimpleResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("course_schedule").delete().eq("id", scheduleId);

  if (error) {
    return { error: "Wochentermin konnte nicht entfernt werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/stundenplan");
  return { success: true };
}

export async function addSchedulePause(scheduleId: string, formData: FormData): Promise<PauseResult> {
  const parsed = schedulePauseSchema.safeParse({
    pause_date: formData.get("pause_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("course_schedule_pauses")
    .insert({
      schedule_id: scheduleId,
      pause_date: parsed.data.pause_date,
    })
    .select("id, pause_date")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Diese Woche ist bereits als pausiert markiert." };
    }
    return { error: "Pause konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/stundenplan");
  return { success: true, pause: { id: data.id, pauseDate: data.pause_date, notifiedAt: null } };
}

export async function deleteSchedulePause(pauseId: string): Promise<SimpleResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("course_schedule_pauses").delete().eq("id", pauseId);

  if (error) {
    return { error: "Pause konnte nicht entfernt werden." };
  }

  revalidatePath("/admin/kurse");
  revalidatePath("/stundenplan");
  return { success: true };
}
