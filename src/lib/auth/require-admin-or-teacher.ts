import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { zweiteStufeLage } from "@/lib/auth/zweite-stufe-lage";
import { WEG_CODE, WEG_EINRICHTEN } from "@/lib/auth/zweite-stufe";

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

  // PROJ-58: Nur Admins. Für Lehrkräfte ändert sich hier nichts — sie kommen
  // an keine Bankdaten und können sich nicht selbst befördern.
  if (profile.role === "admin") {
    const lage = await zweiteStufeLage();
    if (lage === "einrichten") redirect(WEG_EINRICHTEN);
    if (lage === "bestaetigen") redirect(WEG_CODE);
  }

  return { supabase, user, isAdmin: profile.role === "admin" };
}
