import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTeachingUser } from "@/lib/auth/teaches-courses";

export async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/lehrer");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  // PROJ-40: ein Admin, der einem Kurs zugewiesen ist, nutzt diese Seite wie
  // ein Lehrer. Ein Admin ohne Zuweisung sähe hier nur eine leere Liste.
  if (!(await isTeachingUser(supabase, user.id, profile?.role))) {
    redirect("/");
  }

  return { supabase, user };
}

/** Assigned teacher of `courseId` OR admin — used for the course/termin detail routes. */
export async function requireCourseAccess(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/lehrer/${courseId}`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role === "admin") {
    return { supabase, user, isAdmin: true };
  }

  if (profile?.role !== "teacher") {
    redirect("/");
  }

  const { data: assignment } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assignment) {
    redirect("/lehrer");
  }

  return { supabase, user, isAdmin: false };
}
