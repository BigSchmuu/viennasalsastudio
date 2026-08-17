"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { joinWaitlistSchema } from "@/lib/validations/waitlist";
import type { ActionResult } from "@/lib/actions/types";

type JoinWaitlistResult = { error: string } | { needsMandate: true } | { success: true };

export async function joinWaitlist(formData: FormData): Promise<JoinWaitlistResult> {
  const parsed = joinWaitlistSchema.safeParse({
    course_id: formData.get("course_id"),
    desired_plan: formData.get("desired_plan"),
    chosen_date: formData.get("chosen_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data: mandate } = await supabase
    .from("sepa_mandates")
    .select("id")
    .eq("customer_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!mandate) {
    return { needsMandate: true };
  }

  const { data: entryDates } = await supabase
    .from("course_entry_dates")
    .select("entry_date")
    .eq("course_id", parsed.data.course_id);
  const validEntryDates = new Set((entryDates ?? []).map((d) => d.entry_date));
  if (!validEntryDates.has(parsed.data.chosen_date)) {
    return { error: "Ungültiger Einstiegstermin." };
  }

  const { error } = await supabase.rpc("join_waitlist", {
    p_course_id: parsed.data.course_id,
    p_desired_plan: parsed.data.desired_plan,
    p_chosen_date: parsed.data.chosen_date,
  });

  if (error) {
    // join_waitlist re-checks the mandate itself (defense in depth) — map
    // that specific case back to the same needsMandate UI as the pre-check
    // above, in case the two ever disagree (e.g. mandate revoked mid-request).
    if (error.message.includes("mandate required")) {
      return { needsMandate: true };
    }
    return { error: "Eintragen in die Warteliste war nicht möglich. Bitte versuche es erneut." };
  }

  revalidatePath("/kurse");
  revalidatePath("/profil");
  return { success: true };
}

export async function leaveWaitlist(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { error } = await supabase.from("waitlist_entries").delete().eq("id", entryId);
  if (error) {
    return { error: "Warteliste-Eintrag konnte nicht entfernt werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}
