"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { joinWaitlistSchema } from "@/lib/validations/waitlist";
import type { ActionResult } from "@/lib/actions/types";
import { AGB_VERSION } from "@/lib/legal";

type JoinWaitlistResult = { error: string } | { needsMandate: true } | { success: true };

export async function joinWaitlist(formData: FormData): Promise<JoinWaitlistResult> {
  const parsed = joinWaitlistSchema.safeParse({
    course_id: formData.get("course_id"),
    desired_plan: formData.get("desired_plan"),
    chosen_date: formData.get("chosen_date"),
    dance_role: formData.get("dance_role") ?? "",
    terms_accepted: formData.get("terms_accepted") === "true",
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
    p_dance_role: parsed.data.dance_role ?? "",
    p_terms_accepted: parsed.data.terms_accepted ?? false,
    p_terms_version: AGB_VERSION,
  });

  if (error) {
    // join_waitlist re-checks the mandate itself (defense in depth) — map
    // that specific case back to the same needsMandate UI as the pre-check
    // above, in case the two ever disagree (e.g. mandate revoked mid-request).
    if (error.message.includes("terms not accepted")) {
      return { error: "Bitte bestätige zuerst die AGB." };
    }
    if (error.message.includes("dance role required")) {
      return { error: "Bitte wähle, ob du als Leader oder Follower tanzt." };
    }
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
