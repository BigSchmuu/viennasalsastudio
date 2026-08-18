"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SelfCheckinResult = { error: string } | { success: true; status: "present" | "removed" };

export async function selfToggleAttendance(courseId: string): Promise<SelfCheckinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data, error } = await supabase.rpc("self_toggle_attendance", { p_course_id: courseId });

  if (error) {
    if (error.message.includes("too early")) {
      return { error: "Der Self-Check-In ist für diese Stunde noch nicht möglich." };
    }
    if (error.message.includes("no active subscription")) {
      return { error: "Du hast kein aktives Abo für diesen Kurs." };
    }
    if (error.message.includes("cannot undo after class end")) {
      return { error: "Nach Kursende kann der Check-In nicht mehr rückgängig gemacht werden." };
    }
    if (
      error.message.includes("course paused today") ||
      error.message.includes("not today") ||
      error.message.includes("no schedule")
    ) {
      return { error: "Für diesen Kurs findet heute keine Stunde statt." };
    }
    return { error: "Check-In war nicht möglich. Bitte versuche es erneut." };
  }

  revalidatePath("/stundenplan");
  return { success: true, status: data as "present" | "removed" };
}
