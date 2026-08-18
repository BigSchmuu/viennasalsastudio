import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Admin or teacher — used for the event check-in page (PROJ-14). */
export async function requireAdminOrTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/checkin");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin" && profile?.role !== "teacher") {
    redirect("/");
  }

  return { supabase, user };
}
