"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { teacherInviteSchema } from "@/lib/validations/admin";
import type { ActionResult } from "@/lib/actions/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function inviteTeacher(formData: FormData): Promise<ActionResult> {
  const parsed = teacherInviteSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/passwort-zuruecksetzen`,
  });
  if (error) {
    if (error.message?.toLowerCase().includes("already been registered")) {
      return {
        error: "Diese E-Mail ist bereits registriert — bitte stattdessen über die Kundensuche befördern.",
      };
    }
    return { error: "Einladung konnte nicht verschickt werden." };
  }
  if (!data.user) {
    return { error: "Einladung konnte nicht verschickt werden." };
  }

  // The new-user trigger always inserts role='customer' with no name —
  // set the real role and name now that the account exists.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "teacher", full_name: parsed.data.full_name })
    .eq("id", data.user.id);
  if (profileError) {
    return { error: "Einladung wurde verschickt, die Lehrer-Rolle konnte aber nicht gesetzt werden." };
  }

  revalidatePath("/admin/lehrer");
  return { success: true };
}

export async function promoteToTeacher(customerId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ role: "teacher" })
    .eq("id", customerId)
    .eq("role", "customer");
  if (error) {
    return { error: "Beförderung fehlgeschlagen." };
  }

  revalidatePath("/admin/lehrer");
  revalidatePath("/admin/kunden");
  return { success: true };
}

export async function demoteToCustomer(teacherId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ role: "customer" })
    .eq("id", teacherId)
    .eq("role", "teacher");
  if (error) {
    return { error: "Zurückstufung fehlgeschlagen." };
  }

  revalidatePath("/admin/lehrer");
  revalidatePath("/admin/kunden");
  return { success: true };
}
