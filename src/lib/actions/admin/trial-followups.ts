"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ActionResult } from "@/lib/actions/types";

export async function setTrialContacted(bookingId: string, contacted: boolean, note: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("trial_followups").upsert(
    {
      booking_id: bookingId,
      contacted,
      note: note.trim() || null,
      contacted_at: contacted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "booking_id" }
  );

  if (error) {
    return { error: "Speichern fehlgeschlagen" };
  }

  revalidatePath("/admin/probestunden");
  return { success: true };
}
