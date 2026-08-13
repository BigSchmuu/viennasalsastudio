"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { lessonSchema } from "@/lib/validations/admin";
import type { ActionResult } from "@/lib/actions/types";

function parseLessonFormData(formData: FormData) {
  return lessonSchema.safeParse({
    title: formData.get("title"),
    video_set_id: formData.get("video_set_id"),
    video_urls: formData.getAll("video_urls"),
  });
}

async function syncLessonVideos(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  lessonId: string,
  urls: string[]
) {
  await supabase.from("video_set_lesson_videos").delete().eq("lesson_id", lessonId);
  if (urls.length > 0) {
    await supabase.from("video_set_lesson_videos").insert(
      urls.map((url, index) => ({ lesson_id: lessonId, url, position: index }))
    );
  }
}

export async function createLesson(formData: FormData): Promise<ActionResult> {
  const parsed = parseLessonFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase
    .from("video_set_lessons")
    .select("position")
    .eq("video_set_id", parsed.data.video_set_id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("video_set_lessons")
    .insert({
      title: parsed.data.title,
      video_set_id: parsed.data.video_set_id,
      position: nextPosition,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Lektion konnte nicht angelegt werden." };
  }

  await syncLessonVideos(supabase, data.id, parsed.data.video_urls);

  revalidatePath(`/admin/videosaetze/${parsed.data.video_set_id}`);
  return { success: true };
}

export async function updateLesson(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseLessonFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("video_set_lessons")
    .update({ title: parsed.data.title })
    .eq("id", id);

  if (error) {
    return { error: "Lektion konnte nicht gespeichert werden." };
  }

  await syncLessonVideos(supabase, id, parsed.data.video_urls);

  revalidatePath(`/admin/videosaetze/${parsed.data.video_set_id}`);
  return { success: true };
}

export async function deleteLesson(id: string, videoSetId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("video_set_lessons").delete().eq("id", id);

  if (error) {
    return { error: "Lektion konnte nicht gelöscht werden." };
  }

  revalidatePath(`/admin/videosaetze/${videoSetId}`);
  return { success: true };
}

async function swapLessonPositions(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  videoSetId: string,
  lessonId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const { data: lessons } = await supabase
    .from("video_set_lessons")
    .select("id, position")
    .eq("video_set_id", videoSetId)
    .order("position", { ascending: true });

  if (!lessons) {
    return { error: "Lektionen konnten nicht geladen werden." };
  }

  const index = lessons.findIndex((l) => l.id === lessonId);
  const swapWithIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWithIndex < 0 || swapWithIndex >= lessons.length) {
    return { success: true };
  }

  const current = lessons[index];
  const swapWith = lessons[swapWithIndex];

  await supabase.from("video_set_lessons").update({ position: swapWith.position }).eq("id", current.id);
  await supabase.from("video_set_lessons").update({ position: current.position }).eq("id", swapWith.id);

  revalidatePath(`/admin/videosaetze/${videoSetId}`);
  return { success: true };
}

export async function moveLessonUp(lessonId: string, videoSetId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  return swapLessonPositions(supabase, videoSetId, lessonId, "up");
}

export async function moveLessonDown(lessonId: string, videoSetId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  return swapLessonPositions(supabase, videoSetId, lessonId, "down");
}
