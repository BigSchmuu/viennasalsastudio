"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ActionResult } from "@/lib/actions/types";

export async function removeWaitlistEntry(entryId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("waitlist_entries").delete().eq("id", entryId);
  if (error) {
    return { error: "Warteliste-Eintrag konnte nicht entfernt werden." };
  }

  revalidatePath("/admin/kurse");
  return { success: true };
}
