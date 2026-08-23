import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * PROJ-40: who counts as "teaching" for the purposes of the teacher view.
 *
 * A teacher always does — a newly created one has no course yet and should
 * still find "Meine Kurse" waiting for them.
 *
 * An admin only counts once they are actually assigned to a course. Showing
 * the menu entry to every admin would hand most of them a link to an empty
 * page. Their full access to all attendance data through the admin area is a
 * separate, pre-existing right and stays untouched.
 *
 * Kept in one place because the same question is asked by the navigation and by
 * the guard on /lehrer; two copies would eventually disagree.
 */
export async function isTeachingUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: string | null | undefined
): Promise<boolean> {
  if (role === "teacher") return true;
  if (role !== "admin") return false;

  const { count } = await supabase
    .from("course_teachers")
    .select("course_id", { count: "exact", head: true })
    .eq("teacher_id", userId);

  return (count ?? 0) > 0;
}
